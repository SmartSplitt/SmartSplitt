const BigNumber = web3.BigNumber;
const EVMRevert = require('./helpers/EVMRevert');

const time = require('./helpers/time');
const { advanceBlock } = require('./helpers/advanceToBlock');
const { ether } = require('./helpers/ether');

require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(web3.BigNumber))
    .should();

const payEther = async function (target, options) {
    const preBalance = await web3.eth.getBalance(options.from);
    const { receipt } = await target.sendTransaction(options);
    const balance = await web3.eth.getBalance(options.from);
    const fee = (new BigNumber(receipt.gasUsed)).mul(new BigNumber(web3.eth.gasPrice));
    return balance.add(options.value).sub(preBalance.sub(fee));
};

const SmartSplitt = artifacts.require('SmartSplitt');

contract('SmartSplitt', function ([_, wallet1, wallet2, wallet3, wallet4, wallet5]) {
    // let marketingWallet;
    // let teamWallet;

    beforeEach(async function () {
        await advanceBlock();
        this.SmartSplitt = await SmartSplitt.new();
        this.startTime = await time.latest();

        // marketingWallet = await this.SmartSplitt.marketing.call();
        // teamWallet = await this.SmartSplitt.team.call();
    });

    describe('deposit', function () {
        it('should work at least once', async function () {
            (await this.SmartSplitt.depositsCountForUser.call(wallet1)).should.be.bignumber.equal(0);
            (await this.SmartSplitt.totalDeposits.call()).should.be.bignumber.equal(0);

            await this.SmartSplitt.sendTransaction({ value: ether(1), from: wallet1 });
            (await this.SmartSplitt.depositsCountForUser.call(wallet1)).should.be.bignumber.equal(1);
            (await this.SmartSplitt.totalDeposits.call()).should.be.bignumber.equal(ether(1));
        });

        it('should work at least twice from one address', async function () {
            await this.SmartSplitt.sendTransaction({ value: ether(1), from: wallet1 });
            (await this.SmartSplitt.depositsCountForUser.call(wallet1)).should.be.bignumber.equal(1);
            (await this.SmartSplitt.totalDeposits.call()).should.be.bignumber.equal(ether(1));

            await this.SmartSplitt.sendTransaction({ value: ether(2), from: wallet1 });
            (await this.SmartSplitt.depositsCountForUser.call(wallet1)).should.be.bignumber.equal(2);
            (await this.SmartSplitt.totalDeposits.call()).should.be.bignumber.equal(ether(3));
        });

        it('should work at least twice from different addresses', async function () {
            await this.SmartSplitt.sendTransaction({ value: ether(1), from: wallet1 });
            (await this.SmartSplitt.depositsCountForUser.call(wallet1)).should.be.bignumber.equal(1);
            (await this.SmartSplitt.depositsCountForUser.call(wallet2)).should.be.bignumber.equal(0);
            (await this.SmartSplitt.totalDeposits.call()).should.be.bignumber.equal(ether(1));

            await this.SmartSplitt.sendTransaction({ value: ether(2), from: wallet2 });
            (await this.SmartSplitt.depositsCountForUser.call(wallet1)).should.be.bignumber.equal(1);
            (await this.SmartSplitt.depositsCountForUser.call(wallet2)).should.be.bignumber.equal(1);
            (await this.SmartSplitt.totalDeposits.call()).should.be.bignumber.equal(ether(3));
        });

        it('should fail to create more than 50 deposits', async function () {
            for (let i = 0; i < 50; i++) {
                await this.SmartSplitt.sendTransaction({ value: ether(0.1), from: wallet1 });
            }
            (await this.SmartSplitt.depositsCountForUser(wallet1)).should.be.bignumber.equal(50);
            await this.SmartSplitt.sendTransaction({ value: ether(0.1), from: wallet1 }).should.be.rejectedWith(EVMRevert);
        });

        it('should receive dividends for 50 deposits', async function () {
            for (let i = 0; i < 50; i++) {
                await this.SmartSplitt.sendTransaction({ value: ether(0.1), from: wallet1 });
            }
            // console.log(
            await this.SmartSplitt.sendTransaction({ value: 0, from: wallet1 });
            // );
        });

        it('should delete deposits after 50 days', async function () {
            for (let i = 0; i < 10; i++) {
                await this.SmartSplitt.sendTransaction({ value: ether(0.1), from: wallet1 });
            }
            (await this.SmartSplitt.depositsCountForUser(wallet1)).should.be.bignumber.equal(10);

            await time.increaseTo(this.startTime + time.duration.days(10) + time.duration.minutes(1));

            for (let i = 0; i < 20; i++) {
                await this.SmartSplitt.sendTransaction({ value: ether(0.1), from: wallet1 });
            }
            (await this.SmartSplitt.depositsCountForUser(wallet1)).should.be.bignumber.equal(30);

            await time.increaseTo(this.startTime + time.duration.days(50) + time.duration.minutes(2));

            await this.SmartSplitt.sendTransaction({ value: ether(0), from: wallet1 });
            (await this.SmartSplitt.depositsCountForUser(wallet1)).should.be.bignumber.equal(20);
        });
    });

    describe('referral', function () {
        it('should receive refback', async function () {
            await this.SmartSplitt.sendTransaction({ value: ether(1), from: wallet1 });

            await time.increaseTo(this.startTime + time.duration.days(1) + time.duration.seconds(1));

            const dividends = (await payEther(this.SmartSplitt, { value: ether(1), data: wallet1, from: wallet2 })).toNumber();
            dividends.should.be.closeTo(ether(1).mul(15).div(1000).toNumber(), ether(1).div(1000000).toNumber());
        });

        // it('should not pay to first referral until 1 day', async function () {
        //     await this.SmartSplitt.sendTransaction({ value: ether(1), from: wallet1 });

        //     const referralBalance = await web3.eth.getBalance(wallet1);
        //     await this.SmartSplitt.sendTransaction({ value: ether(1), from: wallet2, data: wallet1 });
        //     (await web3.eth.getBalance(wallet1)).should.be.bignumber.equal(referralBalance);
        // });

        it('should pay to first referral after 1 day', async function () {
            await this.SmartSplitt.sendTransaction({ value: ether(1), from: wallet1 });
            await time.increaseTo(this.startTime + time.duration.days(1) + time.duration.seconds(1));

            const referralBalance = await web3.eth.getBalance(wallet1);
            await this.SmartSplitt.sendTransaction({ value: ether(1), from: wallet2, data: wallet1 });
            (await web3.eth.getBalance(wallet1)).should.be.bignumber.equal(referralBalance.add(ether(1).mul(15).div(1000)));
        });

        it('should pay to second referral after 2 days', async function () {
            await this.SmartSplitt.sendTransaction({ value: ether(1), from: wallet1 });
            await time.increaseTo(this.startTime + time.duration.days(1) + time.duration.seconds(1));

            await this.SmartSplitt.sendTransaction({ value: ether(1), from: wallet2, data: wallet1 });
            await time.increaseTo(this.startTime + time.duration.days(2) + time.duration.seconds(2));

            const referralBalance1 = await web3.eth.getBalance(wallet1);
            const referralBalance2 = await web3.eth.getBalance(wallet2);
            await this.SmartSplitt.sendTransaction({ value: ether(1), from: wallet3, data: wallet2 });
            (await web3.eth.getBalance(wallet1)).should.be.bignumber.equal(referralBalance1.add(ether(1).mul(20).div(1000)));
            (await web3.eth.getBalance(wallet2)).should.be.bignumber.equal(referralBalance2.add(ether(1).mul(15).div(1000)));
        });

        it('should pay to third referral after 3 days', async function () {
            await this.SmartSplitt.sendTransaction({ value: ether(1), from: wallet1 });
            await time.increaseTo(this.startTime + time.duration.days(1) + time.duration.seconds(1));

            await this.SmartSplitt.sendTransaction({ value: ether(1), from: wallet2, data: wallet1 });
            await time.increaseTo(this.startTime + time.duration.days(2) + time.duration.seconds(2));

            await this.SmartSplitt.sendTransaction({ value: ether(1), from: wallet3, data: wallet2 });
            await time.increaseTo(this.startTime + time.duration.days(3) + time.duration.seconds(3));

            const referralBalance1 = await web3.eth.getBalance(wallet1);
            const referralBalance2 = await web3.eth.getBalance(wallet2);
            const referralBalance3 = await web3.eth.getBalance(wallet3);
            await this.SmartSplitt.sendTransaction({ value: ether(1), from: wallet4, data: wallet3 });
            (await web3.eth.getBalance(wallet1)).should.be.bignumber.equal(referralBalance1.add(ether(1).mul(10).div(1000)));
            (await web3.eth.getBalance(wallet2)).should.be.bignumber.equal(referralBalance2.add(ether(1).mul(20).div(1000)));
            (await web3.eth.getBalance(wallet3)).should.be.bignumber.equal(referralBalance3.add(ether(1).mul(15).div(1000)));
        });
    });

    describe('withdrawal', function () {
        it('should not work without deposit', async function () {
            await this.SmartSplitt.sendTransaction({ value: ether(1), from: wallet1 });

            const dividends = await payEther(this.SmartSplitt, { value: 0, from: wallet2 });
            dividends.should.be.bignumber.equal(0);
        });

        it('should work after deposit and 1 day wait', async function () {
            await this.SmartSplitt.sendTransaction({ value: ether(1), from: wallet1 });

            await time.increaseTo(this.startTime + time.duration.days(1));

            const dividends = (await payEther(this.SmartSplitt, { value: 0, from: wallet1 })).toNumber();
            dividends.should.be.closeTo(ether(1).mul(3).div(100).toNumber(), ether(1).div(1000000).toNumber());
        });

        it('should work after deposit and 1 hour wait', async function () {
            await this.SmartSplitt.sendTransaction({ value: ether(1), from: wallet1 });

            await time.increaseTo(this.startTime + time.duration.hours(1));

            const dividends = (await payEther(this.SmartSplitt, { value: 0, from: wallet1 })).toNumber();
            dividends.should.be.closeTo(ether(1).div(24).mul(3).div(100).toNumber(), ether(1).div(1000000).toNumber());
        });

        it('should work after deposit and 1 min wait', async function () {
            await this.SmartSplitt.sendTransaction({ value: ether(1), from: wallet1 });

            await time.increaseTo(this.startTime + time.duration.minutes(1));

            const dividends = (await payEther(this.SmartSplitt, { value: 0, from: wallet1 })).toNumber();
            dividends.should.be.closeTo(ether(1).div(24 * 60).mul(3).div(100).toNumber(), ether(1).div(1000000).toNumber());
        });

        it('should work after deposit and 5 day wait', async function () {
            await this.SmartSplitt.sendTransaction({ value: ether(1), from: wallet1 });

            await time.increaseTo(this.startTime + time.duration.days(5));

            const dividends = (await payEther(this.SmartSplitt, { value: 0, from: wallet1 })).toNumber();
            dividends.should.be.closeTo(ether(1).mul(5).mul(3).div(100).toNumber(), ether(1).div(1000000).toNumber());
        });
    });

    it('should receive 60% after 20 days and 1 deposit', async function () {
        await this.SmartSplitt.sendTransaction({ value: ether(1), from: wallet1 });

        await time.increaseTo(this.startTime + time.duration.days(20));

        const dividends = (await payEther(this.SmartSplitt, { value: 0, from: wallet1 })).toNumber();
        dividends.should.be.closeTo(ether(1).mul(60).div(100).toNumber(), ether(1).div(1000000).toNumber());
    });

    it('should receive all available funds after 100 days and 1 deposit', async function () {
        await this.SmartSplitt.sendTransaction({ value: ether(1), from: wallet1 });

        await time.increaseTo(this.startTime + time.duration.days(100));

        const dividends = (await payEther(this.SmartSplitt, { value: 0, from: wallet1 })).toNumber();
        dividends.should.be.closeTo(ether(1).mul(80).div(100).toNumber(), ether(1).div(1000000).toNumber());

        const SmartSplittBalance = await web3.eth.getBalance(this.SmartSplitt.address);
        SmartSplittBalance.should.be.bignumber.equal(0);
    });
});

import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { IbAmm } from './ib-amm';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';

/*
  README
  ======

  This test script adds tests for IbAmm general integration
  with the DEX interface. The test cases below are example tests.
  It is recommended to add tests which cover IbAmm specific
  logic.

  You can run this individual test script by running:
  `npx jest src/dex/<dex-name>/<dex-name>-integration.test.ts`

  (This comment should be removed from the final implementation)
*/

const network = Network.MAINNET;
const TokenASymbol = 'TokenASymbol';
const TokenA = Tokens[network][TokenASymbol];

const TokenBSymbol = 'TokenBSymbol';
const TokenB = Tokens[network][TokenBSymbol];

const amounts = [
  BigInt('0'),
  BigInt('1000000000000000000'),
  BigInt('2000000000000000000'),
];

const dexKey = 'IbAmm';

describe('IbAmm', function () {
  it('getPoolIdentifiers and getPricesVolume SELL', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.provider.getBlockNumber();
    const ibAmm = new IbAmm(network, dexKey, dexHelper);

    await ibAmm.initializePricing(blocknumber);

    const pools = await ibAmm.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.SELL,
      blocknumber,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await ibAmm.getPricesVolume(
      TokenA,
      TokenB,
      amounts,
      SwapSide.SELL,
      blocknumber,
      pools,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    if (ibAmm.hasConstantPriceLargeAmounts) {
      checkConstantPoolPrices(poolPrices!, amounts, dexKey);
    } else {
      checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
    }
  });

  it('getPoolIdentifiers and getPricesVolume BUY', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.provider.getBlockNumber();
    const ibAmm = new IbAmm(network, dexKey, dexHelper);

    await ibAmm.initializePricing(blocknumber);

    const pools = await ibAmm.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.BUY,
      blocknumber,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await ibAmm.getPricesVolume(
      TokenA,
      TokenB,
      amounts,
      SwapSide.BUY,
      blocknumber,
      pools,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    if (ibAmm.hasConstantPriceLargeAmounts) {
      checkConstantPoolPrices(poolPrices!, amounts, dexKey);
    } else {
      checkPoolPrices(poolPrices!, amounts, SwapSide.BUY, dexKey);
    }
  });

  it('getTopPoolsForToken', async function () {
    const dexHelper = new DummyDexHelper(network);
    const ibAmm = new IbAmm(network, dexKey, dexHelper);

    const poolLiquidity = await ibAmm.getTopPoolsForToken(TokenA.address, 10);
    console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

    if (!ibAmm.hasConstantPriceLargeAmounts) {
      checkPoolsLiquidity(poolLiquidity, TokenA.address, dexKey);
    }
  });
});

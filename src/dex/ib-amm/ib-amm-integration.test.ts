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
  `npx jest src/dex/ib-amm/ib-amm-integration.test.ts`

  (This comment should be removed from the final implementation)
*/

const network = Network.MAINNET;
const DAI_SYMBOL = 'DAI';
const DAI = Tokens[network][DAI_SYMBOL];

const IBEUR_SYMBOL = 'IBEUR';
const IBEUR = Tokens[network][IBEUR_SYMBOL];

const MIM_SYMBOL = 'MIM';
const MIM = Tokens[network][MIM_SYMBOL];

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
      IBEUR,
      MIM,
      SwapSide.SELL,
      blocknumber,
    );
    console.log(`${IBEUR_SYMBOL} <> ${MIM_SYMBOL} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await ibAmm.getPricesVolume(
      IBEUR,
      MIM,
      amounts,
      SwapSide.SELL,
      blocknumber,
      pools,
    );
    console.log(`${IBEUR_SYMBOL} <> ${MIM_SYMBOL} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    if (ibAmm.hasConstantPriceLargeAmounts) {
      console.count('🔥');
      checkConstantPoolPrices(poolPrices!, amounts, dexKey);
    } else {
      checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
    }
    console.count('🔥');
  });

  it('getPoolIdentifiers and getPricesVolume BUY', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.provider.getBlockNumber();
    const ibAmm = new IbAmm(network, dexKey, dexHelper);

    await ibAmm.initializePricing(blocknumber);

    const pools = await ibAmm.getPoolIdentifiers(
      DAI,
      IBEUR,
      SwapSide.BUY,
      blocknumber,
    );
    console.log(`${DAI_SYMBOL} <> ${IBEUR_SYMBOL} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await ibAmm.getPricesVolume(
      DAI,
      IBEUR,
      amounts,
      SwapSide.BUY,
      blocknumber,
      pools,
    );
    console.log(`${DAI_SYMBOL} <> ${IBEUR_SYMBOL} Pool Prices: `, poolPrices);

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

    const poolLiquidity = await ibAmm.getTopPoolsForToken(DAI.address, 10);
    console.log(`${DAI_SYMBOL} Top Pools:`, poolLiquidity);

    if (!ibAmm.hasConstantPriceLargeAmounts) {
      checkPoolsLiquidity(poolLiquidity, DAI.address, dexKey);
    }
  });
});

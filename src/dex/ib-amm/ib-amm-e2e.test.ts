import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import {
  Tokens,
  Holders,
  NativeTokenSymbols,
} from '../../../tests/constants-e2e';
import {
  Network,
  ProviderURL,
  ContractMethod,
  SwapSide,
} from '../../constants';
import { JsonRpcProvider } from '@ethersproject/providers';

/*
  README
  ======

  This test script should add e2e tests for IbAmm. The tests
  should cover as many cases as possible. Most of the DEXes follow
  the following test structure:
    - DexName
      - ForkName + Network
        - ContractMethod
          - ETH -> Token swap
          - Token -> ETH swap
          - Token -> Token swap

  The template already enumerates the basic structure which involves 
  testing simpleSwap, multiSwap, megaSwap contract methods for
  ETH <> TOKEN and TOKEN <> TOKEN swaps. You should replace tokenA and 
  tokenB with any two highly liquid tokens on IbAmm for the tests
  to work. If the tokens that you would like to use are not defined in 
  Tokens or Holders map, you can update the './tests/constants-e2e'

  Other than the standard cases that are already added by the template 
  it is highly recommended to add test cases which could be specific 
  to testing IbAmm (Eg. Tests based on poolType, special tokens, 
  etc). 

  You can run this individual test script by running:
  `npx jest src/dex/ib-amm/ib-amm-e2e.test.ts`

  e2e tests use the Tenderly fork api. Please add the following to your 
  .env file:
  TENDERLY_TOKEN=Find this under Account>Settings>Authorization.
  TENDERLY_ACCOUNT_ID=Your Tenderly account name.
  TENDERLY_PROJECT=Name of a Tenderly project you have created in your 
  dashboard.

  (This comment should be removed from the final implementation)
*/

jest.setTimeout(3 * 60 * 1000);

describe('IbAmm E2E', () => {
  describe('IbAmm MAINNET', () => {
    const dexKey = 'ibamm';
    const network = Network.MAINNET;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new JsonRpcProvider(ProviderURL[network]);

    // TODO: Modify the tokenASymbol, tokenBSymbol, tokenAAmount;
    const DAI_SYMBOL: string = 'DAI';
    const MIM_SYMBOL: string = 'MIM';
    const IBEUR_SYMBOL: string = 'IBEUR';
    const NATIVE_TOKEN_SYMBOL = NativeTokenSymbols[network];

    const DAI_AMOUNT: string = '1000000000000000000';
    const MIM_AMOUNT: string = '1000000000000000000';
    const IBEUR_AMOUNT: string = '1000000000000000000';
    const NATIVE_TOKEN_AMOUNT = '1000000000000000000';

    // TODO: Add any direct swap contractMethod name if it exists
    // TODO: If buy is not supported remove the buy contract methods

    describe(`Simpleswap`, () => {
      // expect.assertions(3);
      it('DAI -> IBEUR', async () => {
        await testE2E(
          tokens[DAI_SYMBOL],
          tokens[IBEUR_SYMBOL],
          holders[DAI_SYMBOL],
          DAI_AMOUNT,
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });
  });
});
// TODO: Add any aditional test cases required to test IbAmm

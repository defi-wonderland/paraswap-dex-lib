import { Interface } from '@ethersproject/abi';
import {
  Token,
  Address,
  ExchangePrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
} from '../../types';
import { SwapSide, Network, ProviderURL } from '../../constants';
import { getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { IbAmmData, IbAmmFunctions, IbAmmParams, PoolState } from './types';
import { SimpleExchange } from '../simple-exchange';
import { IbAmmConfig, Adapters } from './config';
import IBAmmRouterABI from '../../abi/ib-amm/ib-amm.json';
import { toLC } from './utils';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Contract } from '@ethersproject/contracts';

export class IbAmm extends SimpleExchange implements IDex<IbAmmData> {
  readonly hasConstantPriceLargeAmounts = false;

  static dexKeys = ['ibamm'];
  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(IbAmmConfig);

  logger: Logger;
  exchangeRouterInterface: Interface;
  poolIdentifier: string;

  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
    protected adapters = Adapters[network],
    protected config = IbAmmConfig[dexKey][network],
  ) {
    super(dexHelper.augustusAddress, dexHelper.provider);
    this.logger = dexHelper.getLogger(dexKey);
    this.exchangeRouterInterface = new Interface(IBAmmRouterABI);
    this.poolIdentifier = `${this.dexKey}_${this.config.IBAMM_ADDRESS}`;
  }

  private poolExists(from: Token, to: Token): boolean {
    const { IB_TOKENS } = this.config;
    const isBuy = toLC(from.address) === toLC(this.config.DAI);

    if (toLC(from.address) === toLC(to.address)) return false;

    if (isBuy) {
      if (IB_TOKENS.every(a => toLC(a) !== toLC(to.address))) return false;
    } else {
      if (toLC(to.address) !== toLC(this.config.MIM)) return false;

      if (IB_TOKENS.every(a => toLC(a) !== toLC(from.address))) return false;
    }

    return true;
  }

  async initializePricing(blockNumber: number) {}

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return null;
  }

  async getPoolIdentifiers(
    from: Token,
    to: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    if (!this.poolExists(from, to)) [];

    return [this.poolIdentifier];
  }

  async getPricesVolume(
    from: Token,
    to: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number, // used on this.eventPools
    limitPools?: string[],
  ): Promise<null | ExchangePrices<IbAmmData>> {
    if (limitPools && limitPools.every(p => p !== this.poolIdentifier))
      return null;

    if (!this.poolExists(from, to)) null;

    const isBuy = toLC(from.address) === toLC(this.config.DAI);

    const token = isBuy ? to : from;

    const unitAmount = BigInt(10 ** token.decimals);

    const provider = new JsonRpcProvider(ProviderURL[Network.MAINNET]);
    const ibammContract = new Contract(
      this.config.IBAMM_ADDRESS,
      IBAmmRouterABI,
      provider,
    );

    const quote = isBuy ? ibammContract.buy_quote : ibammContract.sell_quote;

    const [unit, ...prices] = (await Promise.all(
      [unitAmount, ...amounts].map(async amount =>
        BigInt(await quote(token.address, amount)),
      ),
    )) as bigint[];

    return [
      {
        data: {},
        exchange: this.dexKey,
        gasCost: 200_000, // TODO: improve
        prices,
        unit,
        poolAddresses: [this.poolIdentifier],
      },
    ] as ExchangePrices<IbAmmData>;
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: IbAmmData,
    side: SwapSide,
  ): AdapterExchangeParam {
    return {
      targetExchange: this.config.IBAMM_ADDRESS,
      payload: '0x0',
      networkFee: '0',
    };
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: IbAmmData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const isBuy = toLC(srcToken) === toLC(this.config.DAI);

    const swapFunction = isBuy ? IbAmmFunctions.buy : IbAmmFunctions.sell;

    const swapFunctionParams: IbAmmParams = [
      isBuy ? destToken : srcToken, // token
      srcAmount, // amount
      '0', // TODO: minOut --> maybe fijemosno como hace uni con esto
    ];

    const swapData = this.exchangeRouterInterface.encodeFunctionData(
      swapFunction,
      swapFunctionParams,
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      this.config.IBAMM_ADDRESS,
    );
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    return [];
  }
}

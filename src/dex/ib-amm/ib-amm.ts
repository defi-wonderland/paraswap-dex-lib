import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import {
  Token,
  Address,
  ExchangePrices,
  Log,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
} from '../../types';
import { SwapSide, Network, ProviderURL } from '../../constants';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { wrapETH, getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { IbAmmData, IbAmmFunctions, IbAmmParams, PoolState } from './types';
import { SimpleExchange } from '../simple-exchange';
import { IbAmmConfig, Adapters } from './config';
import IBAmmRouterABI from '../../abi/ib-amm/ib-amm.json';
import { toLC } from './utils';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Contract } from '@ethersproject/contracts';

// export class IbAmmEventPool extends StatefulEventSubscriber<PoolState> {
//   handlers: {
//     [event: string]: (event: any, pool: PoolState, log: Log) => PoolState;
//   } = {};

//   logDecoder: (log: Log) => any;

//   addressesSubscribed: string[];

//   constructor(
//     protected parentName: string,
//     protected network: number,
//     protected dexHelper: IDexHelper,
//     logger: Logger,
//     // TODO: add any additional params required for event subscriber
//   ) {
//     super(parentName, logger);

//     // TODO: make logDecoder decode logs that
//     this.logDecoder = (log: Log) => this.interface.parseLog(log);
//     this.addressesSubscribed = [
//       /* subscribed addresses */
//     ];

//     // Add handlers
//     this.handlers['myEvent'] = this.handleMyEvent.bind(this);
//   }

//   /**
//    * The function is called everytime any of the subscribed
//    * addresses release log. The function accepts the current
//    * state, updates the state according to the log, and returns
//    * the updated state.
//    * @param state - Current state of event subscriber
//    * @param log - Log released by one of the subscribed addresses
//    * @returns Updates state of the event subscriber after the log
//    */
//   protected processLog(
//     state: DeepReadonly<PoolState>,
//     log: Readonly<Log>,
//   ): DeepReadonly<PoolState> | null {
//     try {
//       const event = this.logDecoder(log);
//       if (event.name in this.handlers) {
//         return this.handlers[event.name](event, state, log);
//       }
//       return state;
//     } catch (e) {
//       this.logger.error(
//         `Error_${this.parentName}_processLog could not parse the log with topic ${log.topics}:`,
//         e,
//       );
//       return null;
//     }
//   }

//   /**
//    * The function generates state using on-chain calls. This
//    * function is called to regenrate state if the event based
//    * system fails to fetch events and the local state is no
//    * more correct.
//    * @param blockNumber - Blocknumber for which the state should
//    * should be generated
//    * @returns state of the event subsriber at blocknumber
//    */
//   async generateState(blockNumber: number): Promise<Readonly<PoolState>> {
//     // TODO: complete me!
//   }
// }

export class IbAmm extends SimpleExchange implements IDex<IbAmmData> {
  // protected eventPools: IbAmmEventPool;

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
    protected config = IbAmmConfig[dexKey][network], // TODO: add any additional optional params to support other fork DEXes
  ) {
    super(dexHelper.augustusAddress, dexHelper.provider);
    this.logger = dexHelper.getLogger(dexKey);
    this.exchangeRouterInterface = new Interface(IBAmmRouterABI);
    this.poolIdentifier = `${this.dexKey}_${this.config.IBAMM_ADDRESS}`;

    // this.eventPools = new IbAmmEventPool(
    //   dexKey,
    //   network,
    //   dexHelper,
    //   this.logger,
    // );
  }

  private poolExists(from: Token, to: Token, side: SwapSide): boolean {
    const { IB_TOKENS } = this.config;

    if (toLC(from.address) === toLC(to.address)) return false;

    if (side === SwapSide.BUY) {
      if (toLC(from.address) !== toLC(this.config.DAI)) return false;

      if (!IB_TOKENS.find(a => toLC(a) === toLC(to.address))) return false;
    } else {
      if (toLC(to.address) !== toLC(this.config.MIM)) return false;

      if (!IB_TOKENS.find(a => toLC(a) === toLC(from.address))) return false;
    }

    return true;
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    // TODO: complete me!
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side];
  }

  async getPoolIdentifiers(
    from: Token,
    to: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    if (!this.poolExists(from, to, side)) [];

    return [this.poolIdentifier];
  }

  // Returns pool prices for amounts.
  // If limitPools is defined only pools in limitPools
  // should be used. If limitPools is undefined then
  // any pools can be used.
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

    if (!this.poolExists(from, to, side)) null;

    const unitAmount = BigInt(
      10 ** (side == SwapSide.BUY ? to.decimals : from.decimals),
    );

    const provider = new JsonRpcProvider(ProviderURL[Network.MAINNET]);
    const ibammContract = new Contract(
      this.config.IBAMM_ADDRESS,
      IBAmmRouterABI,
      provider,
    );

    const quote =
      side === SwapSide.BUY
        ? ibammContract.buy_quote
        : ibammContract.sell_quote;
    const token = side === SwapSide.BUY ? to.address : from.address;

    const unit: bigint = BigInt(await quote(token, unitAmount));
    const prices: bigint[] = await Promise.all(
      amounts.map(async amount => BigInt(await quote(token, amount))),
    );

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

  // Encode params required by the exchange adapter
  // Used for multiSwap, buy & megaSwap
  // Hint: abiCoder.encodeParameter() couls be useful
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: IbAmmData,
    side: SwapSide,
  ): AdapterExchangeParam {
    // TODO: complete me!
    return {
      targetExchange: this.config.IBAMM_ADDRESS,
      payload: '0x0',
      networkFee: '0',
    };
  }

  // Encode call data used by simpleSwap like routers
  // Used for simpleSwap & simpleBuy
  // Hint: this.buildSimpleParamWithoutWETHConversion
  // could be useful
  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: IbAmmData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const isBuy = side === SwapSide.BUY;
    const swapFunctionParams: IbAmmParams = [
      isBuy ? destToken : srcToken, // token
      isBuy ? destAmount : srcAmount, // amount
      isBuy ? destAmount : srcAmount, // TODO: minOut --> maybe fijemosno como hace uni con esto
    ];

    const swapData = this.exchangeRouterInterface.encodeFunctionData(
      isBuy ? IbAmmFunctions.buy : IbAmmFunctions.sell,
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

  //   // This is called once before getTopPoolsForToken is
  //   // called for multiple tokens. This can be helpful to
  //   // update common state required for calculating
  //   // getTopPoolsForToken. It is optional for a DEX
  //   // to implement this
  //   updatePoolState(): Promise<void> {
  //   }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    return [];
  }
}

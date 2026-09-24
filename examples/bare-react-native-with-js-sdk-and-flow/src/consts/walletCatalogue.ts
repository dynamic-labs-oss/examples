import type { GetWalletOptionsCatalogueParams } from '@dynamic-labs-sdk/client';

/**
 * How this app asks for the wallet catalogue. One constant because every
 * caller has to ask the same way: the picker and the connect call share a
 * query cache entry keyed on these params, and connecting resolves against
 * the very list the user picked from.
 *
 * `inAppBrowser` is excluded because those wallets connect by loading a web
 * page inside the wallet app, and this app is not a web page. Wallets whose
 * only option was that one drop to the install-only tier instead of offering
 * a connection that cannot work here.
 */
export const WALLET_CATALOGUE_PARAMS: GetWalletOptionsCatalogueParams = {
  excludedConnectionOptionTypes: ['inAppBrowser'],
  includeMobileOptions: true,
};

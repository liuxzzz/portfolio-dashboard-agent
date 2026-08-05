const TZZB_FORWARD_PREFIX = "/caishen_httpserver/tzzb";

export function buildTzzbForwardUrl(baseUrl: string, pathname: string) {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return new URL(`${TZZB_FORWARD_PREFIX}${normalizedPath}`, baseUrl).toString();
}

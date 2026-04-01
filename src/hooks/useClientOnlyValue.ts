/** Native: always use the client value (no static web render path). */
export function useClientOnlyValue<S, C>(server: S, client: C): S | C {
  return client;
}

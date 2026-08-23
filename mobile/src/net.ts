/**
 * Knowing whether there is a connection — when the device can tell us.
 *
 * `@react-native-community/netinfo` is a native module, and it throws while it
 * is being imported if the native side is not in the running binary. That is
 * the normal state of an app build made before the dependency was added, and
 * a static import turns it into a red screen on launch: the whole app dies
 * over an optional convenience.
 *
 * So it is required lazily, once, inside a try. If it is not there, the app
 * assumes it is online and carries on. That is the right default — connectivity
 * detection makes the queue flush *sooner*, it is not what makes it correct.
 * A save still fails, is still held on the device, and is still retried on the
 * next save or refresh. The member loses the "back online" promptness and the
 * offline banner, and nothing else.
 *
 * Reminders are different: a reminder genuinely cannot fire without native
 * code, so `notifications.ts` reports that honestly rather than pretending.
 */

type ConnectivityListener = (online: boolean) => void;

interface NetInfoModule {
  addEventListener: (
    listener: (state: {
      isConnected: boolean | null;
      isInternetReachable: boolean | null;
    }) => void,
  ) => () => void;
}

let resolved = false;
let netInfo: NetInfoModule | null = null;

function load(): NetInfoModule | null {
  if (resolved) return netInfo;
  resolved = true;
  try {
    // Deliberately require, not import: a static import of a missing native
    // module throws during module evaluation, before any handler can run.
    const mod = require("@react-native-community/netinfo");
    const candidate = (mod?.default ?? mod) as NetInfoModule | undefined;
    netInfo =
      typeof candidate?.addEventListener === "function" ? candidate : null;
  } catch {
    netInfo = null;
  }
  if (!netInfo)
    console.warn(
      "[bharosa] NetInfo is unavailable in this build; assuming online. Rebuild the development client to restore connectivity detection.",
    );
  return netInfo;
}

/** True when this build can actually observe connectivity changes. */
export function connectivityIsObservable(): boolean {
  return load() !== null;
}

/**
 * Watch the connection. Returns an unsubscribe function, which is a no-op when
 * the native module is missing — so callers need no special case.
 */
export function subscribeToConnectivity(
  listener: ConnectivityListener,
): () => void {
  const mod = load();
  if (!mod) return () => {};
  try {
    return mod.addEventListener((state) => {
      // `isInternetReachable` is null while it is still being determined.
      // Treating unknown as reachable avoids a banner that flickers on every
      // launch before the probe completes.
      listener(
        Boolean(state.isConnected) && state.isInternetReachable !== false,
      );
    });
  } catch {
    return () => {};
  }
}

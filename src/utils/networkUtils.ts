/**
 * Network utility helpers for AmmoniSense offline-first operations.
 */

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * Executes a promise with a timeout. If the promise does not settle within
 * the given milliseconds, it rejects with a TimeoutError.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number = 3500,
  errorMsg = 'Network timeout / slow connection'
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMsg));
    }, ms);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

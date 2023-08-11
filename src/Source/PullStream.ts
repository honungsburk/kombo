import { remove } from "immutable";
import Stream from "stream";

/**
 * Note: If you are a user of Kombo then this is probably not what you are looking for.
 * It is an implementation detail of the `NodeStreamSource`.
 *
 * This is an abstraction over a NodeJS stream that allows us to pull
 * chunks from the stream. We need this because NodeJS streams are
 * push based, which doesn't work with out parser architecture.
 *
 * Node streams are untyped, so we need to assert that the values
 * we get from the stream are of the correct type.
 */
export default class PullStream<A> {
  private err: NodeJS.ErrnoException | undefined;
  private src: Stream.PassThrough;
  constructor(
    input: Stream.Readable,
    private assertFn: (x: any) => asserts x is A
  ) {
    // Should create a copy of the stream, so others don't interfere with it.
    this.src = new Stream.PassThrough();
    // We pause the stream, so we can control when we read from it.
    this.src.pause();
    Stream.pipeline(
      input,
      this.src,
      (err: NodeJS.ErrnoException | null): void => {
        if (err) {
          this.err = err;
        }
      }
    );
  }

  /**
   * Check if the stream has a space leak.
   *
   * Note: Only used for testing. This is not a public API.
   *
   * @returns true if the stream has a space leak
   */
  _hasSpaceLeak(): boolean {
    return (
      this.src.listenerCount("end") > 20 ||
      this.src.listenerCount("close") > 20 ||
      this.src.listenerCount("error") > 20 ||
      this.src.listenerCount("readable") > 20
    );
  }

  /**
   * Pull the next chunk from the stream. Returns null if the stream is done.
   *
   * Note: DO NOT CALL IN PARALLEL. THIS WILL CAUSE UNDEFINED BEHAVIOR.
   *
   * @returns A or null if the stream is done
   */
  async pull(): Promise<A | null> {
    return new Promise((resolve, reject) => {
      if (this.err) {
        reject(this.err);
      }

      if (this.src.destroyed || this.src.closed || this.src.readableEnded) {
        resolve(null);
      }

      const res: any = this.src.read();
      if (res === null) {
        // To avoid space leaks we need to remove the listeners when we are done.
        // We can not use removeAllListeners because that will remove the
        // listeners for calls to pull that are in progress.
        // (Though we don't allow pull to be called in parallel, so there isn't actually a problem)
        // Instead we only remove the listeners that are relevant for this call.
        const removeListeners = () => {
          this.src.removeListener("readable", read);
          this.src.removeListener("end", resolveNull);
          this.src.removeListener("close", resolveNull);
          this.src.removeListener("error", rejectErr);
        };

        const read = () => {
          const res = this.src.read();
          this.assertFn(res);
          resolve(res);
          removeListeners();
        };
        const resolveNull = () => {
          resolve(null);
          removeListeners();
        };
        const rejectErr = (err: NodeJS.ErrnoException) => {
          this.err = err;
          reject(err);
          removeListeners();
        };
        this.src.on("readable", read);
        this.src.on("end", resolveNull);
        this.src.on("close", resolveNull);
        this.src.on("error", rejectErr);
      } else {
        this.assertFn(res);
        resolve(res);
      }
    });
  }

  /**
   * Close the stream.
   */
  close() {
    if (this.src.destroyed || this.src.closed) {
      return;
    }
    this.src.end();
  }

  /**
   * Destroy the stream.
   */
  destroy() {
    this.src.destroy();
  }
}

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
   * Pull the next chunk from the stream. Returns null if the stream is done.
   *
   * @returns A or null if the stream is done
   */
  async pull(): Promise<A | null> {
    return new Promise((resolve, reject) => {
      if (this.err) {
        reject(this.err);
      }
      if (this.src.destroyed) {
        reject(new Error("Stream is destroyed"));
      }

      if (this.src.closed || this.src.readableEnded) {
        resolve(null);
      }

      const res: any = this.src.read();
      if (res === null) {
        this.src.once("readable", () => {
          const res = this.src.read();
          this.assertFn(res);
          resolve(res);
        });
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

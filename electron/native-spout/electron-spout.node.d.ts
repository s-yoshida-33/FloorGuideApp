declare module "electron-spout" {
  /**
   * SpoutInput - Receives frames FROM a Spout sender
   * Use this to receive video frames from Wonder Flow or any Spout-compatible sender.
   */
  export class SpoutInput {
    /**
     * Creates a Spout receiver that connects to the specified sender.
     * @param senderName The name of the Spout sender to connect to (e.g., "WonderFlow")
     */
    constructor(senderName: string);

    /**
     * Polls the Spout sender for a new frame.
     * Returns true if connected and a frame is available.
     * Must be called before getReceiverWidth/Height and receiveTexture.
     */
    pollReceiver(): boolean;

    /**
     * Returns the width of the received texture (valid after successful pollReceiver).
     */
    getReceiverWidth(): number;

    /**
     * Returns the height of the received texture (valid after successful pollReceiver).
     */
    getReceiverHeight(): number;

    /**
     * Reads the current frame pixels as an RGBA buffer.
     * Must be called after a successful pollReceiver().
     * Returns the pixel buffer, or null on failure.
     */
    receiveTexture(): Buffer | null;

    /**
     * The name of the Spout sender this receiver is connected to.
     */
    readonly name: string;
  }

  /**
   * SpoutOutput - Sends frames TO Spout
   * (From original electron-spout by reitowo)
   */
  export class SpoutOutput {
    constructor(name: string);
    updateFrame(
      buffer: Uint8Array,
      size: { width: number; height: number }
    ): void;
    updateTexture(size: {
      widgetType: string;
      pixelFormat: string;
      sharedTextureHandle: string;
    }): void;
    name: string;
  }
}

/**
 * Send a file as a streamed response. The hosting platform caps buffered responses at
 * 4.5 MB but not streamed ones, so large images and ZIPs go out in chunks.
 */
export function streamBytes(data: Uint8Array | Buffer, chunkSize = 256 * 1024): ReadableStream<Uint8Array> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.byteLength) {
        controller.close();
        return;
      }
      const end = Math.min(offset + chunkSize, bytes.byteLength);
      controller.enqueue(bytes.subarray(offset, end));
      offset = end;
    },
  });
}

export async function recordOneUtterance(ms: number = 5000): Promise<Blob> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' });
  const chunks: BlobPart[] = [];
  return new Promise((resolve) => {
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      resolve(new Blob(chunks, { type: 'audio/webm' }));
    };
    rec.start();
    setTimeout(() => rec.state !== 'inactive' && rec.stop(), ms);
  });
}

import { jobManager } from "@/server/jobs/jobManager";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { jobId: string } }) {
  const { jobId } = params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: { type: string; job: { id: string; status: string } }) => {
        const data = JSON.stringify(event);
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      const off = jobManager.on(jobId, (e) => send(e));

      const current = jobManager.get(jobId);
      if (current) send({ type: current.status, job: current });

      const ping = setInterval(() => controller.enqueue(encoder.encode(`:\n\n`)), 15000);

      return () => {
        off();
        clearInterval(ping);
      };
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // for proxies like nginx
    },
  });
}



// Web Worker que hospeda o motor do WebLLM, mantendo a inferência fora da
// thread principal para não travar a interface.
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm'

const handler = new WebWorkerMLCEngineHandler()
self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg)
}

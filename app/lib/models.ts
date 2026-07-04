export interface ModelDef {
  id: string;
  name: string;
  url: string;
  sizeMB: number;
  inputSize: number;
  /** ImageNet classifiers here output raw logits, so we apply softmax. */
  needsSoftmax: boolean;
  description: string;
}

// Both models are classic ImageNet (1000-class) classifiers from the ONNX
// model zoo. They share the same preprocessing (224x224, NCHW, ImageNet
// mean/std), which lets us benchmark a larger vs. a tiny model head-to-head.
export const MODELS: ModelDef[] = [
  {
    id: "mobilenetv2",
    name: "MobileNet V2",
    url: "/models/mobilenetv2-7.onnx",
    sizeMB: 14,
    inputSize: 224,
    needsSoftmax: true,
    description: "Accurate mid-size classifier (~14 MB). The everyday baseline.",
  },
  {
    id: "squeezenet",
    name: "SqueezeNet 1.1",
    url: "/models/squeezenet1.1-7.onnx",
    sizeMB: 5,
    inputSize: 224,
    needsSoftmax: true,
    description: "Tiny, fast classifier (~5 MB). Lower accuracy, lower latency.",
  },
];

export function getModel(id: string): ModelDef {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}

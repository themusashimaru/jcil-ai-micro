/**
 * ML MODEL SERVING TOOL
 * Design ML model serving infrastructure
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function designModelAPI(config: {
  modelType?: 'classification' | 'regression' | 'nlp' | 'vision' | 'embedding';
  framework?: 'tensorflow' | 'pytorch' | 'onnx' | 'huggingface';
  batchingEnabled?: boolean;
}): Record<string, unknown> {
  const { modelType = 'classification', framework = 'pytorch', batchingEnabled = true } = config;

  return {
    api: {
      endpoint: '/v1/predict',
      method: 'POST',
      request: getRequestSchema(modelType),
      response: getResponseSchema(modelType),
    },
    serverImplementation: generateServerCode(framework, modelType, batchingEnabled),
    dockerfile: generateDockerfile(framework),
    kubernetes: generateK8sManifest(modelType),
    loadTesting: {
      expectedLatency: modelType === 'nlp' ? '100-500ms' : '10-50ms',
      recommendedBatchSize: batchingEnabled ? 32 : 1,
      warmupRequests: 100,
    },
  };
}

function getRequestSchema(modelType: string): Record<string, unknown> {
  const schemas: Record<string, Record<string, unknown>> = {
    classification: {
      type: 'object',
      properties: {
        inputs: { type: 'array', items: { type: 'array' }, description: '2D array of numbers' },
        options: {
          type: 'object',
          properties: {
            topK: { type: 'integer', default: 5 },
            threshold: { type: 'number', default: 0.5 },
          },
        },
      },
    },
    nlp: {
      type: 'object',
      properties: {
        texts: { type: 'array', items: { type: 'string' } },
        options: {
          type: 'object',
          properties: {
            maxLength: { type: 'integer', default: 512 },
            temperature: { type: 'number', default: 1.0 },
          },
        },
      },
    },
    vision: {
      type: 'object',
      properties: {
        images: { type: 'array', items: { type: 'string', format: 'base64' } },
        options: {
          type: 'object',
          properties: {
            resize: { type: 'array', items: { type: 'integer' } },
          },
        },
      },
    },
    embedding: {
      type: 'object',
      properties: {
        texts: { type: 'array', items: { type: 'string' } },
        normalize: { type: 'boolean', default: true },
      },
    },
  };

  return schemas[modelType] || schemas.classification;
}

function getResponseSchema(modelType: string): Record<string, unknown> {
  const schemas: Record<string, Record<string, unknown>> = {
    classification: {
      predictions: [
        { label: 'cat', score: 0.95 },
        { label: 'dog', score: 0.04 },
      ],
      latencyMs: 15,
    },
    nlp: {
      outputs: ['Generated text...'],
      tokens: 256,
      latencyMs: 150,
    },
    vision: {
      predictions: [{ bbox: [10, 20, 100, 200], label: 'person', score: 0.92 }],
      latencyMs: 25,
    },
    embedding: {
      embeddings: [[0.1, 0.2, 0.3]],
      dimensions: 768,
      latencyMs: 20,
    },
  };

  return schemas[modelType] || schemas.classification;
}

function generateServerCode(framework: string, _modelType: string, batching: boolean): string {
  if (framework === 'pytorch') {
    return `import torch
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
import asyncio
from collections import deque
import time

app = FastAPI()

# Load model
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
model = torch.jit.load('model.pt').to(device)
model.eval()

${
  batching
    ? `
# Dynamic batching
class BatchProcessor:
    def __init__(self, max_batch_size=32, max_wait_ms=50):
        self.max_batch_size = max_batch_size
        self.max_wait_ms = max_wait_ms
        self.queue: deque = deque()
        self.processing = False

    async def add_request(self, input_data):
        future = asyncio.Future()
        self.queue.append((input_data, future))

        if not self.processing:
            asyncio.create_task(self.process_batch())

        return await future

    async def process_batch(self):
        self.processing = True
        await asyncio.sleep(self.max_wait_ms / 1000)

        batch = []
        futures = []

        while self.queue and len(batch) < self.max_batch_size:
            input_data, future = self.queue.popleft()
            batch.append(input_data)
            futures.append(future)

        if batch:
            # Run inference
            with torch.no_grad():
                inputs = torch.tensor(batch).to(device)
                outputs = model(inputs)

            for i, future in enumerate(futures):
                future.set_result(outputs[i].cpu().numpy().tolist())

        self.processing = False
        if self.queue:
            asyncio.create_task(self.process_batch())

batch_processor = BatchProcessor()
`
    : ''
}

class PredictRequest(BaseModel):
    inputs: List[List[float]]
    options: Optional[dict] = {}

class PredictResponse(BaseModel):
    predictions: List[dict]
    latency_ms: float

@app.post("/v1/predict", response_model=PredictResponse)
async def predict(request: PredictRequest):
    start = time.time()

    ${
      batching
        ? `results = await asyncio.gather(*[
        batch_processor.add_request(inp) for inp in request.inputs
    ])`
        : `with torch.no_grad():
        inputs = torch.tensor(request.inputs).to(device)
        results = model(inputs).cpu().numpy().tolist()`
    }

    latency = (time.time() - start) * 1000

    predictions = [
        {"label": str(i), "score": max(r) if isinstance(r, list) else r}
        for i, r in enumerate(results)
    ]

    return PredictResponse(predictions=predictions, latency_ms=latency)

@app.get("/health")
async def health():
    return {"status": "healthy", "device": str(device)}`;
  }

  return `# ${framework} implementation placeholder`;
}

function generateDockerfile(framework: string): string {
  const baseImages: Record<string, string> = {
    pytorch: 'pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime',
    tensorflow: 'tensorflow/tensorflow:2.14.0-gpu',
    onnx: 'mcr.microsoft.com/onnxruntime/server:latest',
    huggingface: 'huggingface/transformers-pytorch-gpu:latest',
  };

  return `FROM ${baseImages[framework] || baseImages.pytorch}

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy model and code
COPY model.pt .
COPY app.py .

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \\
  CMD curl -f http://localhost:8000/health || exit 1

# Run server
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]`;
}

function generateK8sManifest(modelType: string): string {
  const gpuNeeded = ['nlp', 'vision'].includes(modelType);

  return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ml-model-server
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ml-model-server
  template:
    metadata:
      labels:
        app: ml-model-server
    spec:
      containers:
      - name: model-server
        image: ml-model:latest
        ports:
        - containerPort: 8000
        resources:
          requests:
            memory: "2Gi"
            cpu: "1"
            ${gpuNeeded ? 'nvidia.com/gpu: "1"' : ''}
          limits:
            memory: "4Gi"
            cpu: "2"
            ${gpuNeeded ? 'nvidia.com/gpu: "1"' : ''}
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 60
          periodSeconds: 30
---
apiVersion: v1
kind: Service
metadata:
  name: ml-model-server
spec:
  selector:
    app: ml-model-server
  ports:
  - port: 80
    targetPort: 8000
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ml-model-server-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ml-model-server
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70`;
}

function designABTest(config: {
  modelA: string;
  modelB: string;
  trafficSplit?: number;
  metrics?: string[];
}): Record<string, unknown> {
  const {
    modelA,
    modelB,
    trafficSplit = 50,
    metrics = ['latency', 'accuracy', 'throughput'],
  } = config;

  return {
    experiment: {
      name: `${modelA}_vs_${modelB}`,
      trafficSplit: { [modelA]: trafficSplit, [modelB]: 100 - trafficSplit },
      metrics,
    },
    implementation: `class ABTestRouter:
    def __init__(self, model_a, model_b, split_pct=50):
        self.model_a = model_a
        self.model_b = model_b
        self.split_pct = split_pct

    async def predict(self, request, user_id: str):
        # Consistent routing based on user_id hash
        use_model_a = hash(user_id) % 100 < self.split_pct

        model = self.model_a if use_model_a else self.model_b
        model_name = '${modelA}' if use_model_a else '${modelB}'

        start = time.time()
        result = await model.predict(request)
        latency = time.time() - start

        # Log for analysis
        log_prediction(
            user_id=user_id,
            model=model_name,
            latency=latency,
            result=result
        )

        return result`,
    analysis: `-- SQL for A/B test analysis
SELECT
    model,
    COUNT(*) as predictions,
    AVG(latency_ms) as avg_latency,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency,
    AVG(CASE WHEN feedback = 'positive' THEN 1 ELSE 0 END) as positive_rate
FROM predictions
WHERE experiment = '${modelA}_vs_${modelB}'
    AND created_at > NOW() - INTERVAL '7 days'
GROUP BY model;`,
    statisticalSignificance: {
      minSampleSize: 1000,
      confidenceLevel: 0.95,
      method: 'Chi-squared test for categorical, t-test for continuous',
    },
  };
}

function designModelRegistry(_config: {
  storage?: 's3' | 'gcs' | 'azure' | 'local';
  versioning?: boolean;
}): Record<string, unknown> {
  return {
    schema: {
      model: {
        id: 'uuid',
        name: 'string',
        version: 'semver',
        framework: 'pytorch | tensorflow | onnx',
        artifactPath: 'string',
        metrics: 'object',
        metadata: 'object',
        stage: 'development | staging | production | archived',
        createdAt: 'timestamp',
        createdBy: 'string',
      },
    },
    implementation: `import boto3
from dataclasses import dataclass
from typing import Optional, Dict, Any
import json

@dataclass
class Model:
    id: str
    name: str
    version: str
    framework: str
    artifact_path: str
    metrics: Dict[str, float]
    metadata: Dict[str, Any]
    stage: str

class ModelRegistry:
    def __init__(self, bucket: str):
        self.s3 = boto3.client('s3')
        self.bucket = bucket
        self.dynamodb = boto3.resource('dynamodb')
        self.table = self.dynamodb.Table('model_registry')

    def register_model(
        self,
        name: str,
        version: str,
        artifact_path: str,
        framework: str,
        metrics: Dict[str, float],
        metadata: Optional[Dict] = None
    ) -> Model:
        import uuid

        model = Model(
            id=str(uuid.uuid4()),
            name=name,
            version=version,
            framework=framework,
            artifact_path=artifact_path,
            metrics=metrics,
            metadata=metadata or {},
            stage='development'
        )

        # Upload artifact to S3
        s3_key = f"models/{name}/{version}/model.{self._get_extension(framework)}"
        self.s3.upload_file(artifact_path, self.bucket, s3_key)

        # Store metadata in DynamoDB
        self.table.put_item(Item={
            'pk': f"MODEL#{name}",
            'sk': f"VERSION#{version}",
            **model.__dict__,
            'artifact_s3_path': f"s3://{self.bucket}/{s3_key}"
        })

        return model

    def get_latest_version(self, name: str, stage: str = 'production') -> Optional[Model]:
        response = self.table.query(
            KeyConditionExpression='pk = :pk',
            FilterExpression='stage = :stage',
            ExpressionAttributeValues={
                ':pk': f"MODEL#{name}",
                ':stage': stage
            },
            ScanIndexForward=False,
            Limit=1
        )

        if response['Items']:
            return Model(**response['Items'][0])
        return None

    def promote_model(self, name: str, version: str, target_stage: str):
        # Demote current production model
        if target_stage == 'production':
            current = self.get_latest_version(name, 'production')
            if current:
                self.table.update_item(
                    Key={'pk': f"MODEL#{name}", 'sk': f"VERSION#{current.version}"},
                    UpdateExpression='SET stage = :stage',
                    ExpressionAttributeValues={':stage': 'archived'}
                )

        # Promote new model
        self.table.update_item(
            Key={'pk': f"MODEL#{name}", 'sk': f"VERSION#{version}"},
            UpdateExpression='SET stage = :stage',
            ExpressionAttributeValues={':stage': target_stage}
        )

    def _get_extension(self, framework: str) -> str:
        return {'pytorch': 'pt', 'tensorflow': 'pb', 'onnx': 'onnx'}[framework]`,
    cli: `# CLI usage
ml-registry register --name my-model --version 1.0.0 \\
    --artifact ./model.pt --framework pytorch \\
    --metrics '{"accuracy": 0.95, "f1": 0.93}'

ml-registry promote --name my-model --version 1.0.0 --stage production

ml-registry get --name my-model --stage production`,
  };
}

function designFeatureStore(_config: {
  storageType?: 'online' | 'offline' | 'both';
}): Record<string, unknown> {
  return {
    architecture: {
      online: 'Redis/DynamoDB for low-latency serving',
      offline: 'S3/BigQuery for training data',
      featureServer: 'gRPC service for feature retrieval',
    },
    featureDefinition: `from feast import Entity, Feature, FeatureView, FileSource, ValueType

# Define entity
user = Entity(
    name="user_id",
    value_type=ValueType.STRING,
    description="User identifier"
)

# Define feature source
user_features_source = FileSource(
    path="s3://bucket/user_features.parquet",
    event_timestamp_column="event_timestamp"
)

# Define feature view
user_features = FeatureView(
    name="user_features",
    entities=["user_id"],
    ttl=timedelta(days=1),
    features=[
        Feature(name="purchase_count_7d", dtype=ValueType.INT64),
        Feature(name="total_spend_30d", dtype=ValueType.FLOAT),
        Feature(name="last_active_days", dtype=ValueType.INT64),
        Feature(name="favorite_category", dtype=ValueType.STRING),
    ],
    online=True,
    source=user_features_source
)`,
    retrieval: `from feast import FeatureStore

store = FeatureStore(repo_path=".")

# Online serving (real-time)
features = store.get_online_features(
    features=[
        "user_features:purchase_count_7d",
        "user_features:total_spend_30d"
    ],
    entity_rows=[{"user_id": "user123"}]
).to_dict()

# Offline retrieval (training)
training_df = store.get_historical_features(
    entity_df=entity_df,  # DataFrame with user_id and event_timestamp
    features=[
        "user_features:purchase_count_7d",
        "user_features:total_spend_30d"
    ]
).to_df()`,
    bestPractices: [
      'Version feature definitions',
      'Monitor feature freshness',
      'Validate feature distributions',
      'Handle missing features gracefully',
      'Use point-in-time correct joins for training',
    ],
  };
}

export const mlModelServingTool: UnifiedTool = {
  name: 'ml_model_serving',
  description: 'ML Model Serving: api, ab_test, registry, feature_store',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['api', 'ab_test', 'registry', 'feature_store'] },
      config: { type: 'object' },
    },
    required: ['operation'],
  },
};

export async function executeMlModelServing(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'api':
        result = designModelAPI(args.config || {});
        break;
      case 'ab_test':
        result = designABTest(
          args.config || {
            modelA: 'model_v1',
            modelB: 'model_v2',
            trafficSplit: 50,
          }
        );
        break;
      case 'registry':
        result = designModelRegistry(args.config || {});
        break;
      case 'feature_store':
        result = designFeatureStore(args.config || {});
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return {
      toolCallId: id,
      content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`,
      isError: true,
    };
  }
}

export function isMlModelServingAvailable(): boolean {
  return true;
}

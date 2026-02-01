/**
 * DATA PIPELINE TOOL
 * Design and generate data pipelines
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function designETLPipeline(config: {
  name: string;
  sources: Array<{ type: string; config: Record<string, unknown> }>;
  transformations: string[];
  destination: { type: string; config: Record<string, unknown> };
}): Record<string, unknown> {
  const { name, sources, transformations, destination } = config;

  return {
    pipeline: {
      name,
      type: 'ETL',
      stages: [
        {
          stage: 'Extract',
          sources: sources.map((s, i) => ({
            id: `source_${i}`,
            type: s.type,
            config: s.config,
            parallelism: s.type === 'database' ? 4 : 1
          }))
        },
        {
          stage: 'Transform',
          operations: transformations.map((t, i) => ({
            order: i + 1,
            operation: t,
            description: describeTransformation(t)
          }))
        },
        {
          stage: 'Load',
          destination: {
            type: destination.type,
            config: destination.config,
            writeMode: 'upsert',
            batchSize: 1000
          }
        }
      ]
    },
    monitoring: {
      metrics: ['records_processed', 'processing_time', 'error_count'],
      alerts: [
        { condition: 'error_rate > 0.01', action: 'pause_pipeline' },
        { condition: 'lag > 5m', action: 'scale_up' }
      ]
    },
    scheduling: {
      cron: '0 2 * * *',
      timezone: 'UTC',
      timeout: '4h',
      retries: 3
    }
  };
}

function describeTransformation(transform: string): string {
  const descriptions: Record<string, string> = {
    'filter': 'Remove records not matching criteria',
    'map': 'Transform each record',
    'aggregate': 'Group and summarize data',
    'join': 'Combine data from multiple sources',
    'deduplicate': 'Remove duplicate records',
    'validate': 'Check data quality',
    'enrich': 'Add data from external sources',
    'normalize': 'Standardize data formats',
    'partition': 'Split data into partitions'
  };
  return descriptions[transform.toLowerCase()] || transform;
}

function generateAirflowDAG(config: {
  dagId: string;
  schedule?: string;
  tasks: Array<{
    id: string;
    type: 'python' | 'bash' | 'sql' | 'sensor' | 'branch';
    config: Record<string, unknown>;
    dependencies?: string[];
  }>;
}): string {
  const { dagId, schedule = '@daily', tasks } = config;

  let dag = `from airflow import DAG
from airflow.operators.python import PythonOperator, BranchPythonOperator
from airflow.operators.bash import BashOperator
from airflow.providers.common.sql.operators.sql import SQLExecuteQueryOperator
from airflow.sensors.filesystem import FileSensor
from datetime import datetime, timedelta

default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'email_on_failure': True,
    'email_on_retry': False,
    'retries': 3,
    'retry_delay': timedelta(minutes=5),
    'start_date': datetime(2024, 1, 1),
}

dag = DAG(
    '${dagId}',
    default_args=default_args,
    description='Auto-generated data pipeline',
    schedule_interval='${schedule}',
    catchup=False,
    max_active_runs=1,
    tags=['data-pipeline', 'auto-generated'],
)

`;

  // Generate task functions
  for (const task of tasks) {
    if (task.type === 'python') {
      dag += `
def ${task.id}_func(**context):
    """${task.config.description || task.id}"""
    # Implementation here
    ${task.config.code || 'pass'}

`;
    }
  }

  // Generate operators
  for (const task of tasks) {
    switch (task.type) {
      case 'python':
        dag += `${task.id} = PythonOperator(
    task_id='${task.id}',
    python_callable=${task.id}_func,
    provide_context=True,
    dag=dag,
)

`;
        break;
      case 'bash':
        dag += `${task.id} = BashOperator(
    task_id='${task.id}',
    bash_command='${task.config.command || 'echo "Hello"'}',
    dag=dag,
)

`;
        break;
      case 'sql':
        dag += `${task.id} = SQLExecuteQueryOperator(
    task_id='${task.id}',
    conn_id='${task.config.connection || 'postgres_default'}',
    sql='${task.config.query || 'SELECT 1'}',
    dag=dag,
)

`;
        break;
      case 'sensor':
        dag += `${task.id} = FileSensor(
    task_id='${task.id}',
    filepath='${task.config.path || '/data/input.csv'}',
    poke_interval=60,
    timeout=3600,
    dag=dag,
)

`;
        break;
      case 'branch':
        dag += `${task.id} = BranchPythonOperator(
    task_id='${task.id}',
    python_callable=${task.id}_func,
    provide_context=True,
    dag=dag,
)

`;
        break;
    }
  }

  // Generate dependencies
  dag += `# Task dependencies\n`;
  for (const task of tasks) {
    if (task.dependencies && task.dependencies.length > 0) {
      dag += `[${task.dependencies.join(', ')}] >> ${task.id}\n`;
    }
  }

  return dag;
}

function generateSparkJob(config: {
  name: string;
  inputPath: string;
  outputPath: string;
  transformations: Array<{
    type: 'filter' | 'select' | 'groupBy' | 'join' | 'withColumn' | 'dropDuplicates';
    params: Record<string, unknown>;
  }>;
  language?: 'scala' | 'python';
}): string {
  const { name, inputPath, outputPath, transformations, language = 'python' } = config;

  if (language === 'python') {
    let job = `from pyspark.sql import SparkSession
from pyspark.sql.functions import col, when, lit, count, sum, avg
from pyspark.sql.types import StructType, StructField, StringType, IntegerType

def main():
    spark = SparkSession.builder \\
        .appName("${name}") \\
        .config("spark.sql.adaptive.enabled", "true") \\
        .config("spark.sql.adaptive.coalescePartitions.enabled", "true") \\
        .getOrCreate()

    # Read input data
    df = spark.read \\
        .option("header", "true") \\
        .option("inferSchema", "true") \\
        .parquet("${inputPath}")

    # Apply transformations
`;

    for (const transform of transformations) {
      switch (transform.type) {
        case 'filter':
          job += `    df = df.filter(${JSON.stringify(transform.params.condition)})\n`;
          break;
        case 'select':
          job += `    df = df.select(${(transform.params.columns as string[]).map(c => `"${c}"`).join(', ')})\n`;
          break;
        case 'groupBy':
          job += `    df = df.groupBy(${(transform.params.columns as string[]).map(c => `"${c}"`).join(', ')}).agg(${transform.params.agg || 'count("*").alias("count")'})\n`;
          break;
        case 'withColumn':
          job += `    df = df.withColumn("${transform.params.name}", ${transform.params.expression})\n`;
          break;
        case 'dropDuplicates':
          job += `    df = df.dropDuplicates(${transform.params.columns ? JSON.stringify(transform.params.columns) : ''})\n`;
          break;
      }
    }

    job += `
    # Write output
    df.write \\
        .mode("overwrite") \\
        .option("compression", "snappy") \\
        .parquet("${outputPath}")

    spark.stop()

if __name__ == "__main__":
    main()
`;

    return job;
  } else {
    let job = `import org.apache.spark.sql.SparkSession
import org.apache.spark.sql.functions._

object ${name.replace(/[^a-zA-Z0-9]/g, '')} {
  def main(args: Array[String]): Unit = {
    val spark = SparkSession.builder()
      .appName("${name}")
      .config("spark.sql.adaptive.enabled", "true")
      .getOrCreate()

    import spark.implicits._

    // Read input
    var df = spark.read
      .option("header", "true")
      .option("inferSchema", "true")
      .parquet("${inputPath}")

    // Transformations
`;

    for (const transform of transformations) {
      switch (transform.type) {
        case 'filter':
          job += `    df = df.filter("${transform.params.condition}")\n`;
          break;
        case 'select':
          job += `    df = df.select(${(transform.params.columns as string[]).map(c => `"${c}"`).join(', ')})\n`;
          break;
        case 'groupBy':
          job += `    df = df.groupBy(${(transform.params.columns as string[]).map(c => `"${c}"`).join(', ')}).agg(count("*").as("count"))\n`;
          break;
      }
    }

    job += `
    // Write output
    df.write
      .mode("overwrite")
      .option("compression", "snappy")
      .parquet("${outputPath}")

    spark.stop()
  }
}
`;

    return job;
  }
}

function generateDbtModel(config: {
  modelName: string;
  sourceTable: string;
  columns: Array<{ name: string; expression?: string; tests?: string[] }>;
  filters?: string[];
  materializedAs?: 'table' | 'view' | 'incremental' | 'ephemeral';
}): Record<string, unknown> {
  const { modelName, sourceTable, columns, filters = [], materializedAs = 'table' } = config;

  const selectCols = columns.map(c =>
    c.expression ? `${c.expression} as ${c.name}` : c.name
  ).join(',\n    ');

  const whereClause = filters.length > 0 ? `\nwhere\n    ${filters.join('\n    and ')}` : '';

  const sqlModel = `{{
  config(
    materialized='${materializedAs}'${materializedAs === 'incremental' ? `,
    unique_key='id',
    incremental_strategy='merge'` : ''}
  )
}}

with source as (
    select * from {{ source('raw', '${sourceTable}') }}
    {% if is_incremental() %}
    where updated_at > (select max(updated_at) from {{ this }})
    {% endif %}
),

transformed as (
    select
    ${selectCols}
    from source${whereClause}
)

select * from transformed
`;

  const schemaYml = `version: 2

models:
  - name: ${modelName}
    description: "Transformed ${sourceTable} data"
    columns:
${columns.map(c => `      - name: ${c.name}
        description: ""
        tests:
${(c.tests || ['not_null']).map(t => `          - ${t}`).join('\n')}`).join('\n')}
`;

  return {
    sql: sqlModel,
    schema: schemaYml,
    path: `models/staging/${modelName}.sql`,
    schemaPath: `models/staging/schema.yml`
  };
}

function designStreamingPipeline(config: {
  name: string;
  source: { type: 'kafka' | 'kinesis' | 'pubsub'; topic: string };
  processing: string[];
  sink: { type: string; config: Record<string, unknown> };
}): Record<string, unknown> {
  const { name, source, processing, sink } = config;

  return {
    pipeline: {
      name,
      type: 'Streaming',
      source: {
        ...source,
        consumerGroup: `${name}-consumer-group`,
        offsetReset: 'earliest',
        commitInterval: '1s'
      },
      processing: {
        framework: 'Apache Flink / Kafka Streams',
        operations: processing.map((p, i) => ({
          order: i + 1,
          operation: p,
          parallelism: 4
        })),
        watermarkStrategy: 'bounded out-of-orderness (5 seconds)',
        stateBackend: 'RocksDB'
      },
      sink: {
        ...sink,
        deliveryGuarantee: 'exactly-once',
        batchSize: 100,
        flushInterval: '1s'
      }
    },
    kafkaStreamsCode: generateKafkaStreamsCode(name, source.topic, processing),
    flinkCode: generateFlinkCode(name, source.topic, processing),
    monitoring: {
      metrics: [
        'records_per_second',
        'processing_latency_p99',
        'consumer_lag',
        'checkpoint_duration'
      ],
      dashboards: ['Grafana with Prometheus'],
      alerts: [
        { condition: 'consumer_lag > 10000', action: 'page_oncall' },
        { condition: 'error_rate > 0.01', action: 'pause_and_alert' }
      ]
    }
  };
}

function generateKafkaStreamsCode(name: string, topic: string, processing: string[]): string {
  return `import org.apache.kafka.streams.KafkaStreams;
import org.apache.kafka.streams.StreamsBuilder;
import org.apache.kafka.streams.StreamsConfig;
import org.apache.kafka.streams.kstream.KStream;

public class ${name.replace(/[^a-zA-Z0-9]/g, '')}Stream {
    public static void main(String[] args) {
        Properties props = new Properties();
        props.put(StreamsConfig.APPLICATION_ID_CONFIG, "${name}");
        props.put(StreamsConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
        props.put(StreamsConfig.PROCESSING_GUARANTEE_CONFIG, StreamsConfig.EXACTLY_ONCE_V2);

        StreamsBuilder builder = new StreamsBuilder();
        KStream<String, String> stream = builder.stream("${topic}");

        // Processing pipeline
        stream
${processing.map(p => `            .peek((k, v) -> log.info("Processing: ${p}"))`).join('\n')}
            .to("${topic}-output");

        KafkaStreams streams = new KafkaStreams(builder.build(), props);
        streams.start();

        Runtime.getRuntime().addShutdownHook(new Thread(streams::close));
    }
}`;
}

function generateFlinkCode(name: string, topic: string, processing: string[]): string {
  return `from pyflink.datastream import StreamExecutionEnvironment
from pyflink.datastream.connectors.kafka import FlinkKafkaConsumer, FlinkKafkaProducer
from pyflink.common.serialization import SimpleStringSchema

def main():
    env = StreamExecutionEnvironment.get_execution_environment()
    env.enable_checkpointing(60000)  # 1 minute
    env.set_parallelism(4)

    # Kafka source
    kafka_consumer = FlinkKafkaConsumer(
        topics='${topic}',
        deserialization_schema=SimpleStringSchema(),
        properties={
            'bootstrap.servers': 'localhost:9092',
            'group.id': '${name}-consumer'
        }
    )
    kafka_consumer.set_start_from_earliest()

    # Create stream
    stream = env.add_source(kafka_consumer)

    # Processing pipeline
${processing.map(p => `    # ${p}
    stream = stream.map(lambda x: x)  # Implement ${p}`).join('\n')}

    # Sink
    kafka_producer = FlinkKafkaProducer(
        topic='${topic}-output',
        serialization_schema=SimpleStringSchema(),
        producer_config={'bootstrap.servers': 'localhost:9092'}
    )
    stream.add_sink(kafka_producer)

    env.execute('${name}')

if __name__ == '__main__':
    main()`;
}

export const dataPipelineTool: UnifiedTool = {
  name: 'data_pipeline',
  description: 'Data Pipeline: etl, airflow_dag, spark_job, dbt_model, streaming',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['etl', 'airflow_dag', 'spark_job', 'dbt_model', 'streaming'] },
      config: { type: 'object' }
    },
    required: ['operation']
  },
};

export async function executeDataPipeline(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown> | string;

    switch (args.operation) {
      case 'etl':
        result = designETLPipeline(args.config || {
          name: 'user_analytics_pipeline',
          sources: [
            { type: 'database', config: { table: 'users' } },
            { type: 's3', config: { bucket: 'events' } }
          ],
          transformations: ['filter', 'join', 'aggregate', 'validate'],
          destination: { type: 'warehouse', config: { table: 'analytics.user_metrics' } }
        });
        break;
      case 'airflow_dag':
        result = { dag: generateAirflowDAG(args.config || {
          dagId: 'daily_data_pipeline',
          schedule: '0 2 * * *',
          tasks: [
            { id: 'extract_data', type: 'python', config: { description: 'Extract from sources' } },
            { id: 'transform_data', type: 'python', config: { description: 'Transform data' }, dependencies: ['extract_data'] },
            { id: 'load_data', type: 'python', config: { description: 'Load to warehouse' }, dependencies: ['transform_data'] }
          ]
        })};
        break;
      case 'spark_job':
        result = { job: generateSparkJob(args.config || {
          name: 'UserAggregation',
          inputPath: 's3://data/users/',
          outputPath: 's3://data/user_metrics/',
          transformations: [
            { type: 'filter', params: { condition: 'active = true' } },
            { type: 'groupBy', params: { columns: ['country'], agg: 'count("*").alias("user_count")' } }
          ]
        })};
        break;
      case 'dbt_model':
        result = generateDbtModel(args.config || {
          modelName: 'stg_users',
          sourceTable: 'raw_users',
          columns: [
            { name: 'user_id', tests: ['not_null', 'unique'] },
            { name: 'email', tests: ['not_null'] },
            { name: 'created_at' },
            { name: 'is_active', expression: "case when status = 'active' then true else false end" }
          ],
          filters: ["created_at >= '2024-01-01'"],
          materializedAs: 'incremental'
        });
        break;
      case 'streaming':
        result = designStreamingPipeline(args.config || {
          name: 'real_time_analytics',
          source: { type: 'kafka', topic: 'events' },
          processing: ['parse', 'enrich', 'aggregate', 'filter'],
          sink: { type: 'elasticsearch', config: { index: 'analytics' } }
        });
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: typeof result === 'string' ? result : JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isDataPipelineAvailable(): boolean { return true; }

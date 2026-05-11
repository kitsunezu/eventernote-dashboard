import { WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { Resource } from '@opentelemetry/resources'

/**
 * Initialise OpenTelemetry browser tracing.
 *
 * Traces are sent via the nginx reverse-proxy at /api/otel/v1/traces,
 * which forwards to the SigNoz OTLP/HTTP collector (port 4318).
 *
 * Configure the collector address by setting the OTEL_BACKEND env var
 * on the container at start time (see docker-compose.yml).
 *
 * SigNoz quick-start:
 *   https://signoz.io/docs/install/docker/
 */
export function setupOtel() {
  const provider = new WebTracerProvider({
    resource: new Resource({
      'service.name': 'eventernote-dashboard',
    }),
  })

  provider.addSpanProcessor(
    new BatchSpanProcessor(
      new OTLPTraceExporter({ url: '/api/otel/v1/traces' }),
    ),
  )

  provider.register()

  registerInstrumentations({
    instrumentations: [
      new FetchInstrumentation({
        // Avoid tracing the OTel export calls themselves
        ignoreUrls: [/\/api\/otel/],
      }),
    ],
  })
}

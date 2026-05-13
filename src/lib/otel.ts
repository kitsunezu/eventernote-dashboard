import { WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { resourceFromAttributes } from '@opentelemetry/resources'

/**
 * Initialise OpenTelemetry browser tracing.
 *
 * Traces are sent via the nginx reverse-proxy at /api/otel/v1/traces,
 * which forwards to the SigNoz OTLP/HTTP collector (port 4318).
 *
 * Client IP is read from the X-Client-IP response header injected by nginx
 * and attached as a span attribute on every outgoing fetch.
 *
 * SigNoz quick-start:
 *   https://signoz.io/docs/install/docker/
 */
export function setupOtel() {
  // Extract the schedule-owner id from the URL path (e.g. /slan1024 → "slan1024")
  const scheduleId = window.location.pathname.split('/').filter(Boolean)[0] ?? ''

  const provider = new WebTracerProvider({
    resource: resourceFromAttributes({
      'service.name': 'eventernote-dashboard',
      'deployment.environment': 'production',
      // Identifies which user's schedule is being viewed; useful for
      // filtering SigNoz traces/dashboards per schedule owner.
      'app.schedule_id': scheduleId,
    }),
    spanProcessors: [
      new BatchSpanProcessor(
        new OTLPTraceExporter({ url: '/api/otel/v1/traces' }),
      ),
    ],
  })

  provider.register()

  registerInstrumentations({
    instrumentations: [
      new FetchInstrumentation({
        // Avoid tracing the OTel export calls themselves
        ignoreUrls: [/\/api\/otel/],
        // Attach client IP (injected by nginx) as a span attribute
        applyCustomAttributesOnSpan(span, _request, result) {
          const resp = result instanceof Response ? result : undefined
          const ip = resp?.headers.get('x-client-ip')
          if (ip) span.setAttribute('http.client_ip', ip)
          // Record the page path so SigNoz dashboards can group by page
          span.setAttribute('page.path', window.location.pathname)
        },
      }),
    ],
  })
}

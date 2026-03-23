/**
 * OpenTelemetry browser instrumentation — traces + error logging.
 *
 * Traces: document load, fetch/XHR requests → exported via OTLP HTTP to the collector.
 * Logs:   unhandled errors and promise rejections → exported via OTLP HTTP for Loki.
 *
 * Import this file in main.tsx BEFORE rendering the app.
 */

import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { ZoneContextManager } from "@opentelemetry/context-zone";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { DocumentLoadInstrumentation } from "@opentelemetry/instrumentation-document-load";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { XMLHttpRequestInstrumentation } from "@opentelemetry/instrumentation-xml-http-request";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

// Log export for error reporting to Loki
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { LoggerProvider, BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { SeverityNumber } from "@opentelemetry/api-logs";

const OTEL_ENDPOINT =
  (window as any).__RUNTIME_CONFIG__?.VITE_OTEL_ENDPOINT ||
  import.meta.env.VITE_OTEL_ENDPOINT ||
  "";
const SERVICE_NAME = "finance-tracker-frontend";

let loggerProvider: LoggerProvider | null = null;

export function initTelemetry() {
  if (!OTEL_ENDPOINT) {
    console.info(
      "[telemetry] VITE_OTEL_ENDPOINT not set — telemetry disabled"
    );
    return;
  }

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: SERVICE_NAME,
    "deployment.environment": import.meta.env.MODE,
  });

  // ── Traces ──────────────────────────────────────────────────
  const traceExporter = new OTLPTraceExporter({
    url: `${OTEL_ENDPOINT}/v1/traces`,
  });

  const tracerProvider = new WebTracerProvider({
    resource,
    spanProcessors: [new BatchSpanProcessor(traceExporter)],
  });

  tracerProvider.register({
    contextManager: new ZoneContextManager(),
  });

  registerInstrumentations({
    instrumentations: [
      new DocumentLoadInstrumentation(),
      new FetchInstrumentation({
        // Propagate W3C trace context to same-origin API calls
        propagateTraceHeaderCorsUrls: [
          new RegExp(
            (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&"
            )
          ),
        ],
      }),
      new XMLHttpRequestInstrumentation({
        propagateTraceHeaderCorsUrls: [
          new RegExp(
            (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&"
            )
          ),
        ],
      }),
    ],
  });

  // ── Logs (error reporting) ──────────────────────────────────
  const logExporter = new OTLPLogExporter({
    url: `${OTEL_ENDPOINT}/v1/logs`,
  });

  loggerProvider = new LoggerProvider({
    resource,
    processors: [new BatchLogRecordProcessor(logExporter)],
  });

  // Capture unhandled errors
  window.addEventListener("error", (event) => {
    emitLogRecord(
      SeverityNumber.ERROR,
      event.message,
      {
        "error.type": "unhandled_error",
        "error.filename": event.filename || "",
        "error.lineno": String(event.lineno || ""),
        "error.colno": String(event.colno || ""),
        "error.stack": event.error?.stack || "",
        "page.url": window.location.href,
      }
    );
  });

  // Capture unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    const reason =
      event.reason instanceof Error
        ? event.reason.message
        : String(event.reason);
    emitLogRecord(
      SeverityNumber.ERROR,
      `Unhandled promise rejection: ${reason}`,
      {
        "error.type": "unhandled_rejection",
        "error.stack":
          event.reason instanceof Error ? event.reason.stack || "" : "",
        "page.url": window.location.href,
      }
    );
  });

  console.info(`[telemetry] initialized — exporting to ${OTEL_ENDPOINT}`);
}

function emitLogRecord(
  severityNumber: SeverityNumber,
  body: string,
  attributes: Record<string, string>
) {
  if (!loggerProvider) return;
  const logger = loggerProvider.getLogger(SERVICE_NAME);
  logger.emit({
    severityNumber,
    severityText: severityNumber >= SeverityNumber.ERROR ? "ERROR" : "WARN",
    body,
    attributes,
  });
}

/**
 * Manually log an error (e.g. from a catch block or error boundary).
 */
export function reportError(error: Error, context?: Record<string, string>) {
  emitLogRecord(SeverityNumber.ERROR, error.message, {
    "error.type": "reported_error",
    "error.name": error.name,
    "error.stack": error.stack || "",
    "page.url": window.location.href,
    ...context,
  });
}

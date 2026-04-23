type LogLevel = 'info' | 'warn' | 'error';
type LogContext = Record<string, unknown>;

function emit(level: LogLevel, message: string, context: LogContext): void {
  const entry = {
    time: new Date().toISOString(),
    level,
    message,
    ...context,
  };
  const out = level === 'error' ? process.stderr : process.stdout;
  out.write(JSON.stringify(entry) + '\n');
}

export const logger = {
  info: (message: string, context: LogContext = {}) =>
    emit('info', message, context),
  warn: (message: string, context: LogContext = {}) =>
    emit('warn', message, context),
  error: (message: string, context: LogContext = {}) =>
    emit('error', message, context),
};

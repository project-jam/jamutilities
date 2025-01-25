import chalk from 'chalk';
import moment from 'moment';

enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL',
  COMMAND = 'COMMAND'
}

class Logger {
  private static logLevels = {
    [LogLevel.DEBUG]: 0,
    [LogLevel.INFO]: 1,
    [LogLevel.WARN]: 2,
    [LogLevel.ERROR]: 3,
    [LogLevel.FATAL]: 4,
    [LogLevel.COMMAND]: 1  // Same level as INFO
  };

  private static level: LogLevel = LogLevel.INFO;

  static setLevel(level: LogLevel) {
    Logger.level = level;
  }

  static debug(message: string) {
    if (Logger.logLevels[Logger.level] <= Logger.logLevels[LogLevel.DEBUG]) {
      console.log(`
╔════════════════════════════════════════════════════╗
[${chalk.gray('DEBUG')} ${moment().format('YYYY-MM-DD HH:mm:ss')}] ${message}
╚════════════════════════════════════════════════════╝`);
    }
  }

  static info(message: string) {
    if (Logger.logLevels[Logger.level] <= Logger.logLevels[LogLevel.INFO]) {
      console.log(`
╔════════════════════════════════════════════════════╗
[${chalk.blue('INFO')} ${moment().format('YYYY-MM-DD HH:mm:ss')}] ${message}
╚════════════════════════════════════════════════════╝`);
    }
  }

  static warn(message: string) {
    if (Logger.logLevels[Logger.level] <= Logger.logLevels[LogLevel.WARN]) {
      console.log(`
╔════════════════════════════════════════════════════╗
[${chalk.yellow('WARN')} ${moment().format('YYYY-MM-DD HH:mm:ss')}] ${message}
╚════════════════════════════════════════════════════╝`);
    }
  }

  static error(message: string, error?: any) {
    if (Logger.logLevels[Logger.level] <= Logger.logLevels[LogLevel.ERROR]) {
      console.error(`
╔════════════════════════════════════════════════════╗
[${chalk.red('ERROR')} ${moment().format('YYYY-MM-DD HH:mm:ss')}] ${message}
${error ? `\n${chalk.red(error)}` : ''}
╚════════════════════════════════════════════════════╝`);
    }
  }

  static fatal(message: string, error?: any) {
    if (Logger.logLevels[Logger.level] <= Logger.logLevels[LogLevel.FATAL]) {
      console.error(`
╔════════════════════════════════════════════════════╗
[${chalk.red('FATAL')} ${moment().format('YYYY-MM-DD HH:mm:ss')}] ${message}
${error ? `${chalk.red(error)}` : ''}
╚════════════════════════════════════════════════════╝`);
      process.exit(1);
    }
  }

  static success(message: string) {
    if (Logger.logLevels[Logger.level] <= Logger.logLevels[LogLevel.INFO]) {
      console.log(`
╔════════════════════════════════════════════════════╗
[${chalk.green('SUCCESS')} ${moment().format('YYYY-MM-DD HH:mm:ss')}] ${message}
╚════════════════════════════════════════════════════╝`);
    }
  }

  static command(message: string) {
    if (Logger.logLevels[Logger.level] <= Logger.logLevels[LogLevel.COMMAND]) {
      console.log(`
╔════════════════════════════════════════════════════╗
[${chalk.cyan('COMMAND')} ${moment().format('YYYY-MM-DD HH:mm:ss')}] ${message}
╚════════════════════════════════════════════════════╝`);
    }
  }
}

Logger.setLevel(LogLevel.DEBUG);

export { Logger, LogLevel };

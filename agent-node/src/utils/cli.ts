import { exec } from "child_process";
import { promisify } from "util";
import { createLogger } from "./logger.js";

const execAsync = promisify(exec);
const logger = createLogger("CLIWrapper");

/**
 * Execute a shell command (e.g. OnchainOS CLI) and return standard output.
 * If the command fails, it throws an error containing stderr.
 */
export async function execCommand(command: string): Promise<string> {
  logger.debug(`Executing CLI command: ${command}`);
  
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stderr && stderr.trim().length > 0) {
      logger.warn(`CLI Command produced stderr: ${stderr.trim()}`);
    }
    return stdout.trim();
  } catch (error) {
    logger.error(`CLI Command failed: ${command}`, { error });
    throw error;
  }
}

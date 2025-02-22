import { BackportError } from './lib/BackportError';
import { cherrypickAndCreateTargetPullRequest } from './lib/cherrypickAndCreateTargetPullRequest';
import { logger, consoleLog } from './lib/logger';
import { sequentially } from './lib/sequentially';
import { Commit } from './lib/sourceCommit/parseSourceCommit';
import { ValidConfigOptions } from './options/options';

export type SuccessResult = {
  status: 'success';
  didUpdate: boolean;
  targetBranch: string;
  pullRequestUrl: string;
  pullRequestNumber: number;
};

export type HandledErrorResult = {
  status: 'handled-error';
  targetBranch: string;
  error: BackportError;
};

export type UnhandledErrorResult = {
  status: 'unhandled-error';
  targetBranch: string;
  error: Error;
};

export type Result = SuccessResult | HandledErrorResult | UnhandledErrorResult;

export async function runSequentially({
  options,
  commits,
  targetBranches,
}: {
  options: ValidConfigOptions;
  commits: Commit[];
  targetBranches: string[];
}): Promise<Result[]> {
  logger.verbose('Backport options', options);

  const results = [] as Result[];

  await sequentially(targetBranches, async (targetBranch) => {
    logger.info(`Backporting ${JSON.stringify(commits)} to ${targetBranch}`);
    try {
      const { number, url, didUpdate } =
        await cherrypickAndCreateTargetPullRequest({
          options,
          commits,
          targetBranch,
        });

      results.push({
        targetBranch,
        status: 'success',
        didUpdate,
        pullRequestUrl: url,
        pullRequestNumber: number,
      });
    } catch (e) {
      const isHandledError = e instanceof BackportError;
      if (isHandledError) {
        results.push({
          targetBranch,
          status: 'handled-error',
          error: e,
        });
      } else if (e instanceof Error) {
        results.push({
          targetBranch,
          status: 'unhandled-error',
          error: e,
        });
      } else {
        throw e;
      }

      consoleLog(
        isHandledError
          ? e.message
          : 'An unhandled error occurred while backporting commit. Please see the logs for details'
      );

      logger.error('runSequentially failed', e);
    }
  });

  // return the results for consumers to programatically read
  return results;
}

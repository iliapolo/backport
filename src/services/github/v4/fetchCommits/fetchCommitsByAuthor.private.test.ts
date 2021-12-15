import { ValidConfigOptions } from '../../../../options/options';
import { getDevAccessToken } from '../../../../test/private/getDevAccessToken';
import { PromiseReturnType } from '../../../../types/PromiseReturnType';
import { Commit } from '../../../sourceCommit';
import { fetchCommitsByAuthor } from './fetchCommitsByAuthor';

describe('fetchCommitsByAuthor', () => {
  let devAccessToken: string;

  beforeAll(async () => {
    devAccessToken = await getDevAccessToken();
  });

  describe('commitPaths', () => {
    const getOptions = () =>
      ({
        repoOwner: 'backport-org',
        repoName: 'repo-with-different-commit-paths',
        sourceBranch: 'main',
        accessToken: devAccessToken,
        username: 'sqren',
        author: 'sqren',
        maxNumber: 10,
        githubApiBaseUrlV4: 'https://api.github.com/graphql',
      } as ValidConfigOptions);

    const getCommitMessages = (commits: Commit[]) => {
      return commits.map((c) =>
        c.originalMessage.replace(/(\r\n|\n|\r)/gm, '')
      );
    };

    it('returns all commits', async () => {
      const commits = await fetchCommitsByAuthor({
        ...getOptions(),
        commitPaths: [] as Array<string>,
      });

      const commitMessages = getCommitMessages(commits);
      expect(commitMessages).toEqual([
        'Edit all lyrics',
        'Update .backportrc.json',
        'Edit "Take on me"',
        'Add backportrc.json',
        'Add "Bohemian Rhapsody""',
        'Add "99 Luftballons"',
        'Add "Take on me"',
      ]);
    });

    it('only returns commits related to "99-luftballons.txt"', async () => {
      const commits = await fetchCommitsByAuthor({
        ...getOptions(),
        commitPaths: ['lyrics/99-luftballons.txt'],
      });

      const commitMessages = getCommitMessages(commits);
      expect(commitMessages).toEqual([
        'Edit all lyrics',
        'Add "99 Luftballons"',
      ]);
    });

    it('only returns commits related to "take-on-me.txt"', async () => {
      const commits = await fetchCommitsByAuthor({
        ...getOptions(),
        commitPaths: ['lyrics/take-on-me.txt'],
      });

      const commitMessages = getCommitMessages(commits);
      expect(commitMessages).toEqual([
        'Edit all lyrics',
        'Edit "Take on me"',
        'Add "Take on me"',
      ]);
    });

    it('removes duplicates and order by `committedDate`', async () => {
      const commits = await fetchCommitsByAuthor({
        ...getOptions(),
        commitPaths: [
          'lyrics/99-luftballons.txt',
          'lyrics/take-on-me.txt',
          'lyrics/bohemian-rhapsody.txt',
        ],
      });

      const commitMessages = getCommitMessages(commits);
      expect(commitMessages).toEqual([
        'Edit all lyrics',
        'Edit "Take on me"',
        'Add "Bohemian Rhapsody""',
        'Add "99 Luftballons"',
        'Add "Take on me"',
      ]);
    });
  });

  describe('existingTargetPullRequests', () => {
    let res: PromiseReturnType<typeof fetchCommitsByAuthor>;
    beforeEach(async () => {
      res = await fetchCommitsByAuthor({
        repoOwner: 'backport-org',
        repoName: 'backport-e2e',
        sourceBranch: 'master',
        accessToken: devAccessToken,
        username: 'sqren',
        author: 'sqren',
        maxNumber: 10,
        githubApiBaseUrlV4: 'https://api.github.com/graphql',
        commitPaths: [] as Array<string>,
      } as ValidConfigOptions);
    });

    it('returns related OPEN PRs', async () => {
      const commitWithOpenPR = res.find((commit) => commit.pullNumber === 9);
      expect(commitWithOpenPR?.existingTargetPullRequests).toEqual([
        { branch: '7.8', state: 'OPEN', number: 10 },
      ]);
    });

    it('returns related MERGED PRs', async () => {
      const commitWithMergedPRs = res.find((commit) => commit.pullNumber === 5);
      expect(commitWithMergedPRs?.existingTargetPullRequests).toEqual([
        { branch: '7.x', state: 'MERGED', number: 6 },
        { branch: '7.8', state: 'MERGED', number: 7 },
      ]);
    });

    it('returns empty if there are no related PRs', async () => {
      const commitWithoutPRs = res.find((commit) => commit.pullNumber === 8);
      expect(commitWithoutPRs?.existingTargetPullRequests).toEqual([]);
    });
  });
});
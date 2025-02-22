import axios, { AxiosResponse } from 'axios';
import { DocumentNode } from 'graphql';
import { print } from 'graphql/language/printer';
import { BackportError } from '../../BackportError';
import { logger } from '../../logger';

interface GithubError {
  type?: string;
  path?: string[];
  locations?: {
    line: number;
    column: number;
  }[];
  message: string;
}

export interface GithubV4Response<DataResponse> {
  data: DataResponse;
  errors?: GithubError[];
}

type Variables = Record<string, string | number | null>;

export async function apiRequestV4<DataResponse>({
  githubApiBaseUrlV4 = 'https://api.github.com/graphql',
  accessToken,
  query,
  variables,
}: {
  githubApiBaseUrlV4?: string;
  accessToken: string;
  query: DocumentNode;
  variables?: Variables;
}) {
  try {
    const response = await axios.post<GithubV4Response<DataResponse>>(
      githubApiBaseUrlV4,
      { query: print(query), variables },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `bearer ${accessToken}`,
        },
      }
    );

    if (response.data.errors) {
      throw new GithubV4Exception(response);
    }

    addDebugLogs({
      githubApiBaseUrlV4,
      query,
      variables,
      githubResponse: response,
    });

    return response.data.data;
  } catch (e) {
    if (axios.isAxiosError(e) && e.response) {
      addDebugLogs({
        githubApiBaseUrlV4,
        query,
        variables,
        githubResponse: e.response,
        didThrow: true,
      });
      throw new GithubV4Exception(e.response, e.message);
    }

    throw e;
  }
}

function addDebugLogs({
  githubApiBaseUrlV4,
  query,
  variables,
  githubResponse,
  didThrow = false,
}: {
  githubApiBaseUrlV4: string;
  query: DocumentNode;
  variables?: Variables;
  githubResponse: AxiosResponse;
  didThrow?: boolean;
}) {
  const gqlQueryName = getQueryName(query);
  logger.info(
    `POST ${githubApiBaseUrlV4} (name:${gqlQueryName}, status: ${
      githubResponse.status
    }${didThrow ? ', EXCEPTION THROWN' : ''})`
  );

  logger.verbose(`Query: ${print(query)}`);
  logger.verbose('Variables:', variables);
  logger.verbose('Response headers:', githubResponse.headers);
  logger.verbose('Response data:', githubResponse.data);
}

type AxiosGithubResponse<DataResponse> = AxiosResponse<
  GithubV4Response<DataResponse | null>,
  any
>;
export class GithubV4Exception<DataResponse> extends Error {
  githubResponse: AxiosGithubResponse<DataResponse> & { request: undefined };

  constructor(
    githubResponse: AxiosGithubResponse<DataResponse>,
    errorMessage?: string
  ) {
    const githubMessage = githubResponse.data.errors
      ?.map((error) => error.message)
      .join(',');

    const message = `${
      errorMessage ?? githubMessage ?? 'Unknown error'
    } (Github API v4)`;

    super(message);
    Error.captureStackTrace(this, BackportError);
    this.name = 'GithubV4Exception';
    this.message = message;
    this.githubResponse = { ...githubResponse, request: undefined };
  }
}

export function getQueryName(query: DocumentNode): string {
  //@ts-expect-error
  return query.definitions[0].name?.value;
}

import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  // The shared system temp volume can be full in isolated worktrees. Disabling
  // Jest's transform cache keeps the standard test command able to run.
  cache: false,
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  // Nested git worktrees (.claude/worktrees/<name>/) contain full copies of this
  // repo's test files. Without this, jest recurses into them from the main
  // checkout and double-runs (or more) every test against stale/incomplete copies.
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.claude/'],
};

export default createJestConfig(config);

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, CheckCircle, Github } from 'lucide-react';
import { useAuthStatus } from '../hooks/useAuthStatus.ts';
import { SetupStepIndicator } from '../components/features/auth/SetupStepIndicator.tsx';
import { ClaudeAuthCard } from '../components/features/auth/index.ts';
import { GitHubAuthCard } from '../components/features/auth/index.ts';

const STEPS = [
  { label: 'Claude', key: 'claude' },
  { label: 'GitHub', key: 'github' },
];

export function SetupWizardPage() {
  const navigate = useNavigate();
  const {
    authStatus,
    loginSession,
    claudeLoginSession,
    loading,
    loginInProgress,
    claudeLoginInProgress,
    startLogin,
    startClaudeAuth,
    submitClaudeCode,
    logout,
  } = useAuthStatus();

  const [claudeError, setClaudeError] = useState<string | null>(null);
  const [githubError, setGithubError] = useState<string | null>(null);

  // Derive current step and completed steps from auth status (no effects needed)
  const claudeAuthenticated = authStatus?.claude?.authenticated ?? false;
  const githubAuthenticated = authStatus?.github?.authenticated ?? false;

  const currentStep = useMemo(() => {
    if (claudeAuthenticated && githubAuthenticated) return 2;
    if (claudeAuthenticated) return 1;
    return 0;
  }, [claudeAuthenticated, githubAuthenticated]);

  const completedSteps = useMemo(() => {
    const steps: number[] = [];
    if (claudeAuthenticated) steps.push(0);
    if (githubAuthenticated) steps.push(1);
    return steps;
  }, [claudeAuthenticated, githubAuthenticated]);

  const handleClaudeLogin = async () => {
    setClaudeError(null);
    const response = await startClaudeAuth();
    if (!response) {
      setClaudeError('Failed to start Claude login. Is the Claude CLI installed?');
    } else if (response.status === 'already_authenticated') {
      // polling will pick it up
    } else if (response.status === 'error') {
      setClaudeError('Failed to start Claude login. Is the Claude CLI installed?');
    }
  };

  const handleSubmitClaudeCode = async (code: string) => {
    const success = await submitClaudeCode(code);
    if (!success) {
      setClaudeError('Failed to submit authorization code. Please try again.');
    }
  };

  const handleGithubLogin = async () => {
    setGithubError(null);
    const response = await startLogin();
    if (!response || response.status === 'error') {
      setGithubError('Failed to start GitHub login. Is the gh CLI installed?');
    }
  };

  const handleOpenConsole = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center">
      <div className="max-w-lg w-full mx-4">
        {/* Logo + Title */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Bot className="h-10 w-10 text-accent-blue" />
            <h1 className="text-3xl font-bold text-gray-100">Agent Orchestra</h1>
          </div>
          <p className="text-gray-400">Welcome — let&apos;s get you connected</p>
        </div>

        {/* Step Indicator */}
        <div className="mb-8">
          <SetupStepIndicator
            steps={STEPS}
            currentStep={currentStep}
            completedSteps={completedSteps}
          />
        </div>

        {/* Step Content */}
        <div className="rounded-xl border border-surface-600 bg-surface-800 p-6">
          {currentStep === 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-100">Connect Claude Code</h2>
                <p className="text-sm text-gray-400 mt-1">
                  Authenticate with the Claude CLI so Orchestra can run AI agents on your behalf.
                </p>
              </div>
              <ClaudeAuthCard
                authStatus={authStatus}
                claudeLoginSession={claudeLoginSession}
                loading={loading}
                claudeLoginInProgress={claudeLoginInProgress}
                onLogin={handleClaudeLogin}
                onSubmitCode={handleSubmitClaudeCode}
                error={claudeError}
                compact
              />
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-100">Connect GitHub</h2>
                <p className="text-sm text-gray-400 mt-1">
                  Link your GitHub account so Orchestra can access repositories and open pull requests.
                </p>
              </div>
              <GitHubAuthCard
                authStatus={authStatus}
                loginSession={loginSession}
                loading={loading}
                loginInProgress={loginInProgress}
                onLogin={handleGithubLogin}
                onLogout={logout}
                error={githubError}
                compact
              />
            </div>
          )}

          {currentStep === 2 && (
            <div className="text-center space-y-4">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <div>
                <h2 className="text-lg font-semibold text-gray-100">You&apos;re all set!</h2>
                <div className="mt-3 space-y-1.5 text-sm text-gray-400">
                  {authStatus?.claude?.email && (
                    <p>
                      Claude: <span className="text-gray-200">{authStatus.claude.email}</span>
                    </p>
                  )}
                  {!authStatus?.claude?.email && claudeAuthenticated && (
                    <p>
                      Claude: <span className="text-gray-200">Authenticated</span>
                    </p>
                  )}
                  {authStatus?.github?.username && (
                    <p>
                      GitHub: <span className="text-gray-200 inline-flex items-center gap-1"><Github className="h-3.5 w-3.5" />{authStatus.github.username}</span>
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleOpenConsole}
                className="rounded-lg bg-accent-blue px-6 py-2.5 text-sm font-medium text-white hover:bg-accent-blue/80 transition-colors"
              >
                Open Console
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

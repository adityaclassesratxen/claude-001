import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, Loader2, CheckCircle, XCircle } from 'lucide-react';
import styled from 'styled-components';
import ThemeSelector from '../components/ThemeSelector';

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Password strength indicators
  const [passwordStrength, setPasswordStrength] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  });

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      try {
        setTokenValid(false);
        setError('Failed to validate reset token');
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token]);

  // Check password strength
  useEffect(() => {
    setPasswordStrength({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[@$!%*?&]/.test(password)
    });
  }, [password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!Object.values(passwordStrength).every(v => v)) {
      setError('Password does not meet all requirements');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setTimeout(() => navigate('/login'), 3000);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <PageContainer>
        <LoaderCard>
          <Loader2 size={48} className="spin" />
          <p>Validating reset token...</p>
        </LoaderCard>
      </PageContainer>
    );
  }

  if (!tokenValid) {
    return (
      <PageContainer>
        <ThemeSelector />
        <ErrorCard>
          <XCircle size={64} color="var(--color-error)" />
          <ErrorTitle>Invalid or Expired Token</ErrorTitle>
          <ErrorMessage>{error}</ErrorMessage>
          <BackButton to="/forgot-password">Request New Link</BackButton>
        </ErrorCard>
      </PageContainer>
    );
  }

  if (success) {
    return (
      <PageContainer>
        <ThemeSelector />
        <SuccessCard>
          <CheckCircle size={64} color="var(--color-success)" />
          <SuccessTitle>Password Reset Successful!</SuccessTitle>
          <SuccessMessage>Redirecting to login page...</SuccessMessage>
        </SuccessCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <ThemeSelector />
      
      <FormCard>
        <Header>
          <IconWrapper>
            <Lock size={32} />
          </IconWrapper>
          <Title>Set New Password</Title>
          <Subtitle>for {userEmail}</Subtitle>
        </Header>

        <Form onSubmit={handleSubmit}>
          <InputGroup>
            <Label>New Password</Label>
            <InputWrapper>
              <Lock size={18} />
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                required
              />
              <EyeButton type="button" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </EyeButton>
            </InputWrapper>

            <StrengthIndicator>
              <StrengthItem $valid={passwordStrength.length}>
                {passwordStrength.length ? '✓' : '○'} At least 8 characters
              </StrengthItem>
              <StrengthItem $valid={passwordStrength.uppercase}>
                {passwordStrength.uppercase ? '✓' : '○'} One uppercase letter
              </StrengthItem>
              <StrengthItem $valid={passwordStrength.lowercase}>
                {passwordStrength.lowercase ? '✓' : '○'} One lowercase letter
              </StrengthItem>
              <StrengthItem $valid={passwordStrength.number}>
                {passwordStrength.number ? '✓' : '○'} One number
              </StrengthItem>
              <StrengthItem $valid={passwordStrength.special}>
                {passwordStrength.special ? '✓' : '○'} One special character (@$!%*?&)
              </StrengthItem>
            </StrengthIndicator>
          </InputGroup>

          <InputGroup>
            <Label>Confirm Password</Label>
            <InputWrapper>
              <Lock size={18} />
              <Input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
              />
              <EyeButton type="button" onClick={() => setShowConfirm(!showConfirm)}>
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </EyeButton>
            </InputWrapper>
            {confirmPassword && password !== confirmPassword && (
              <ErrorText>Passwords do not match</ErrorText>
            )}
          </InputGroup>

          {error && <ErrorMessage>{error}</ErrorMessage>}

          <SubmitButton 
            type="submit" 
            disabled={loading || password !== confirmPassword || !Object.values(passwordStrength).every(v => v)}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="spin" />
                Resetting...
              </>
            ) : (
              'Reset Password'
            )}
          </SubmitButton>
        </Form>

        <Footer>
          <BackLink to="/login">Back to Login</BackLink>
        </Footer>
      </FormCard>
    </PageContainer>
  );
};

// Styled Components (reuse from ForgotPassword + add new ones)
const PageContainer = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  padding: 20px;
`;

const FormCard = styled.div`
  background: var(--color-surface);
  border-radius: 16px;
  padding: 40px;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
`;

const LoaderCard = styled(FormCard)`
  text-align: center;
  padding: 60px 40px;

  .spin {
    animation: spin 1s linear infinite;
    margin-bottom: 20px;
    color: var(--color-primary);
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  p {
    color: var(--color-textSecondary);
  }
`;

const ErrorCard = styled(FormCard)`
  text-align: center;
`;

const SuccessCard = styled(FormCard)`
  text-align: center;
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 32px;
`;

const IconWrapper = styled.div`
  width: 64px;
  height: 64px;
  background: var(--color-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  color: white;
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 8px;
`;

const Subtitle = styled.p`
  color: var(--color-textSecondary);
  font-size: 14px;
`;

const ErrorTitle = styled(Title)`
  margin-top: 20px;
`;

const SuccessTitle = styled(Title)`
  margin-top: 20px;
`;

const ErrorMessage = styled.div`
  background: #fee;
  color: var(--color-error);
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
  border-left: 4px solid var(--color-error);
  margin: 16px 0;
`;

const SuccessMessage = styled.p`
  color: var(--color-textSecondary);
  margin-top: 12px;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.label`
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
`;

const InputWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--color-background);
  border: 2px solid var(--color-border);
  border-radius: 8px;
  padding: 12px 16px;
  transition: all 0.3s ease;

  svg {
    color: var(--color-textSecondary);
    flex-shrink: 0;
  }

  &:focus-within {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }
`;

const Input = styled.input`
  flex: 1;
  border: none;
  background: transparent;
  color: var(--color-text);
  font-size: 14px;
  outline: none;

  &::placeholder {
    color: var(--color-textSecondary);
  }
`;

const EyeButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-textSecondary);
  padding: 0;
  display: flex;
  align-items: center;
  transition: color 0.3s ease;

  &:hover {
    color: var(--color-primary);
  }
`;

const StrengthIndicator = styled.div`
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px;
  margin-top: 8px;
`;

const StrengthItem = styled.div`
  font-size: 13px;
  color: ${props => props.$valid ? 'var(--color-success)' : 'var(--color-textSecondary)'};
  padding: 4px 0;
  font-weight: ${props => props.$valid ? '600' : '400'};
`;

const ErrorText = styled.div`
  font-size: 12px;
  color: var(--color-error);
  margin-top: 4px;
`;

const SubmitButton = styled.button`
  background: var(--color-primary);
  color: white;
  border: none;
  padding: 14px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 8px;

  &:hover:not(:disabled) {
    background: var(--color-primaryHover);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

const BackButton = styled(Link)`
  display: inline-block;
  background: var(--color-primary);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  margin-top: 20px;
  transition: all 0.3s ease;

  &:hover {
    background: var(--color-primaryHover);
    transform: translateY(-2px);
  }
`;

const Footer = styled.div`
  margin-top: 24px;
  text-align: center;
`;

const BackLink = styled(Link)`
  color: var(--color-textSecondary);
  text-decoration: none;
  font-size: 14px;
  transition: color 0.3s ease;

  &:hover {
    color: var(--color-primary);
  }
`;

export default ResetPassword;
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        <button type="submit">Set new password</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
}

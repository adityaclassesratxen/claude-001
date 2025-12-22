import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import styled from "styled-components";
import ThemeSelector from "../components/ThemeSelector";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        "http://localhost:5000/api/auth/forgot-password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json();

      if (data.success) {
        setSent(true);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Failed to send reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <ThemeSelector />

      <FormCard>
        {sent ? (
          <SuccessView>
            <CheckCircle size={64} color="var(--color-success)" />
            <SuccessTitle>Check Your Email</SuccessTitle>
            <SuccessMessage>
              If an account exists with <strong>{email}</strong>, you will
              receive a password reset link shortly.
            </SuccessMessage>
            <BackButton to="/login">
              <ArrowLeft size={16} />
              Back to Login
            </BackButton>
          </SuccessView>
        ) : (
          <>
            <Header>
              <IconWrapper>
                <Mail size={32} />
              </IconWrapper>
              <Title>Forgot Password?</Title>
              <Subtitle>
                Enter your email and we'll send you a reset link
              </Subtitle>
            </Header>

            <Form onSubmit={handleSubmit}>
              <InputGroup>
                <Label>Email Address</Label>
                <InputWrapper>
                  <Mail size={18} />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    required
                  />
                </InputWrapper>
              </InputGroup>

              {error && <ErrorMessage>{error}</ErrorMessage>}

              <SubmitButton type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 size={18} className="spin" />
                    Sending...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </SubmitButton>
            </Form>

            <Footer>
              <BackLink to="/login">
                <ArrowLeft size={16} />
                Back to Login
              </BackLink>
            </Footer>
          </>
        )}
      </FormCard>
    </PageContainer>
  );
};

// Styled Components
const PageContainer = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    135deg,
    var(--color-primary) 0%,
    var(--color-secondary) 100%
  );
  padding: 20px;
`;

const FormCard = styled.div`
  background: var(--color-surface);
  border-radius: 16px;
  padding: 40px;
  width: 100%;
  max-width: 450px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
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
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

const ErrorMessage = styled.div`
  background: #fee;
  color: var(--color-error);
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
  border-left: 4px solid var(--color-error);
`;

const Footer = styled.div`
  margin-top: 24px;
  text-align: center;
`;

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--color-textSecondary);
  text-decoration: none;
  font-size: 14px;
  transition: color 0.3s ease;

  &:hover {
    color: var(--color-primary);
  }
`;

const SuccessView = styled.div`
  text-align: center;
`;

const SuccessTitle = styled.h2`
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text);
  margin: 20px 0 12px;
`;

const SuccessMessage = styled.p`
  color: var(--color-textSecondary);
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 32px;

  strong {
    color: var(--color-text);
  }
`;

const BackButton = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--color-primary);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  transition: all 0.3s ease;

  &:hover {
    background: var(--color-primaryHover);
    transform: translateY(-2px);
  }
`;

export default ForgotPassword;

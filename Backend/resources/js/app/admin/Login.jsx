import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Form, Input, Button, Alert, Typography } from "antd";
import {
  UserOutlined,
  LockOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
  ArrowRightOutlined,
} from "@ant-design/icons";
import { api } from "@/config/api";
import logo from "@/assets/logooos.jpg";

const { Title, Text } = Typography;

function Login() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (values) => {
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/admin/login", {
        username: values.username,
        password: values.password,
      });

      const { token, user, role } = response.data;

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("role", role || user?.role || "");
      localStorage.setItem("isLoggedIn", "true");

      if ((role || user?.role) === "admin") {
        navigate("/dashboard");
      } else {
        navigate("/staff-dashboard");
      }
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        "Unable to connect to backend. Check API URL and server.";

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="nm-dark"
      style={{
        minHeight: "100vh",
        background: "#1F1A2E",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative background elements */}
      <div
        style={{
          position: "absolute",
          width: 420,
          height: 420,
          borderRadius: "50%",
          background: "rgba(34, 211, 168, 0.07)",
          top: -180,
          right: -150,
        }}
      />

      <div
        style={{
          position: "absolute",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: "rgba(22, 180, 140, 0.06)",
          bottom: -140,
          left: -120,
        }}
      />

      {/* Main Login Container */}
      <div
        style={{
          width: "100%",
          maxWidth: 1050,
          minHeight: 620,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          background: "#2A2438",
          borderRadius: 28,
          overflow: "hidden",
          boxShadow: "0 25px 70px rgba(0, 0, 0, 0.45)",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* =========================================
            LEFT BRAND PANEL
        ========================================= */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            background: "linear-gradient(160deg, #17131F 0%, #2A2438 100%)",
            minHeight: 620,
          }}
        >
          {/* Full Logo Image */}
          <img
            src={logo}
            alt="New Moon Lechon Manok & Liempo House"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
            }}
          />

          {/* Plum gradient scrim over brand image */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(160deg, rgba(23, 19, 31, 0.35) 0%, rgba(42, 36, 56, 0.75) 100%)",
            }}
          />

          {/* Mint accent line at bottom of brand panel */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 4,
              background:
                "linear-gradient(90deg, #22D3A8, #16B48C)",
            }}
          />
        </div>

        {/* =========================================
            RIGHT LOGIN PANEL
        ========================================= */}
        <div
          style={{
            background: "#2A2438",
            padding: "65px 65px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          {/* Login Heading */}
          <div style={{ marginBottom: 35 }}>
            <Text
              style={{
                color: "#22D3A8",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              ADMIN PORTAL
            </Text>

            <Title
              style={{
                margin: "10px 0 7px",
                color: "#FFFFFF",
                fontSize: 36,
                fontWeight: 800,
                letterSpacing: "-1px",
              }}
            >
              Welcome back 👋
            </Title>

            <Text
              style={{
                color: "#A5A0B5",
                fontSize: 15,
              }}
            >
              Sign in to continue to your NewMoon account.
            </Text>

            {/* Accent */}
            <div
              style={{
                width: 50,
                height: 4,
                borderRadius: 10,
                background: "linear-gradient(90deg, #22D3A8, #16B48C)",
                marginTop: 18,
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              closable
              onClose={() => setError("")}
              style={{
                marginBottom: 24,
                borderRadius: 12,
              }}
            />
          )}

          {/* Form */}
          <Form
            form={form}
            layout="vertical"
            onFinish={handleLogin}
            requiredMark={false}
            size="large"
          >
            {/* Username */}
            <Form.Item
              name="username"
              label={
                <span
                  style={{
                    color: "#FFFFFF",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  Username
                </span>
              }
              rules={[
                {
                  required: true,
                  message: "Please enter your username",
                },
              ]}
              style={{ marginBottom: 22 }}
            >
              <Input
                prefix={
                  <UserOutlined
                    style={{
                      color: "#A5A0B5",
                      fontSize: 18,
                    }}
                  />
                }
                placeholder="Enter your username"
                autoFocus
                style={{
                  height: 54,
                  borderRadius: 14,
                  background: "#332C45",
                  border: "1px solid rgba(255,255,255,0.06)",
                  fontSize: 15,
                  color: "#FFFFFF",
                }}
              />
            </Form.Item>

            {/* Password */}
            <Form.Item
              name="password"
              label={
                <span
                  style={{
                    color: "#FFFFFF",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  Password
                </span>
              }
              rules={[
                {
                  required: true,
                  message: "Please enter your password",
                },
              ]}
              style={{ marginBottom: 10 }}
            >
              <Input.Password
                prefix={
                  <LockOutlined
                    style={{
                      color: "#A5A0B5",
                      fontSize: 18,
                    }}
                  />
                }
                placeholder="Enter your password"
                iconRender={(visible) =>
                  visible ? (
                    <EyeTwoTone />
                  ) : (
                    <EyeInvisibleOutlined
                      style={{ color: "#A5A0B5" }}
                    />
                  )
                }
                style={{
                  height: 54,
                  borderRadius: 14,
                  background: "#332C45",
                  border: "1px solid rgba(255,255,255,0.06)",
                  fontSize: 15,
                  color: "#FFFFFF",
                }}
              />
            </Form.Item>

            {/* Sign In */}
            <Form.Item style={{ marginBottom: 0, marginTop: 25 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                size="large"
                icon={!loading ? <ArrowRightOutlined /> : null}
                iconPlacement="end"
                style={{
                  height: 56,
                  borderRadius: 15,
                  border: "none",
                  background:
                    "linear-gradient(135deg, #22D3A8 0%, #16B48C 100%)",
                  color: "#1F1A2E",
                  fontWeight: 700,
                  fontSize: 15,
                  letterSpacing: 0.4,
                  boxShadow:
                    "0 10px 30px rgba(0, 0, 0, 0.35)",
                }}
              >
                Sign In
              </Button>
            </Form.Item>
          </Form>

          {/* Footer */}
          <div
            style={{
              marginTop: 35,
              paddingTop: 22,
              borderTop: "1px solid rgba(255,255,255,0.06)",
              textAlign: "center",
            }}
          >
            <Text
              style={{
                color: "#A5A0B5",
                fontSize: 11,
                letterSpacing: 1.5,
              }}
            >
              NEWMOON • LECHON MANOK & LIEMPO
</Text>
           </div>
         </div>
       </div>
     </div>
   );
 }

export default Login;
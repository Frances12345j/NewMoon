import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider } from "antd";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { spinConfig } from "./components/spinConfig.jsx";
import AdminApp from "./AdminApp";
import "antd/dist/reset.css";

const queryClient = new QueryClient();

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ConfigProvider spin={spinConfig}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AdminApp />
          </BrowserRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </React.StrictMode>
  );
}

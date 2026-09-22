import React from "react";
import MenuSidebar from "./Sidebar";

function MenuLayout({ children }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#1F1A2E" }}>
      <MenuSidebar />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          overflowY: "auto",
          overflowX: "hidden",
          height: "100vh",
          background: "#1F1A2E",
          padding: "20px 24px",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default MenuLayout;
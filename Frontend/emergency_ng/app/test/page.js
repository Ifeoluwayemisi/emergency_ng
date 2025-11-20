import RoleLayout from "../components/RoleLayout";

export default function TestNavbar() {
  return (
    <RoleLayout role="responder">
      {" "}
      {/* change role: "user", "responder", "admin" */}
      <h1 className="text-3xl font-bold mb-4">Test Page for Navbar</h1>
      <p>
        Click the buttons in the navbar to see navigation (won’t break) and
        logout works.
      </p>
    </RoleLayout>
  );
}

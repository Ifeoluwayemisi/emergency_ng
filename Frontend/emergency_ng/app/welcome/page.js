export default function Welcome() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <h1 className="text-4xl font-bold mb-4">
        Welcome to RapidAid Emergency App
      </h1>
      <p className="mb-6">Fastest emergency response at your fingertips.</p>
      <div className="space-x-4">
        <a href="/login" className="px-6 py-2 bg-blue-600 text-white rounded">
          Login
        </a>
        <a href="/signup" className="px-6 py-2 bg-green-600 text-white rounded">
          Sign Up
        </a>
      </div>
    </div>
  );
}
import { Link } from 'react-router-dom'

const NotFound = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-ethereal-900 via-ethereal-800 to-desert-800 flex items-center justify-center px-6">
      <div className="text-center">
        <h1 className="text-9xl font-display font-bold text-white/20 mb-4">404</h1>
        <h2 className="text-3xl font-display font-semibold text-white mb-4">Page Not Found</h2>
        <p className="text-white/80 mb-8 max-w-md mx-auto">
          The page you're looking for seems to have drifted away like pixels in the wind.
        </p>
        <Link
          to="/"
          className="inline-block px-8 py-4 bg-desert-600 hover:bg-desert-700 text-white font-semibold rounded-full transition-all duration-300 transform hover:scale-105"
        >
          Return Home
        </Link>
      </div>
    </div>
  )
}

export default NotFound
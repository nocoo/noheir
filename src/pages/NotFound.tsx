import { Link } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary">
      <div className="text-center">
        <h1 className="text-[12rem] font-bold leading-none text-white/50">404</h1>
        <Link to="/" className="inline-block mt-8 text-white/70 hover:text-white transition-colors">
          返回首页
        </Link>
      </div>
    </div>
  );
};

export default NotFound;

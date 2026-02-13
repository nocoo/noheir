import { Link } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-[12rem] font-bold leading-none text-muted-foreground/30">
          404
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">页面不存在</p>
        <Link
          to="/"
          className="inline-block mt-8 text-sm text-primary hover:underline transition-colors"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
};

export default NotFound;

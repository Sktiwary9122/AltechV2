import GlobalNumberWheelBlocker from "./components/GlobalNumberWheelBlocker";
import AppRouter from "./router/AppRouter";
import { ToastContainer } from "react-toastify";

export default function App() {
  console.log("this is auth token",localStorage.getItem('authToken'));
  return <>
    <GlobalNumberWheelBlocker />
    <ToastContainer
        position="top-right"
        autoClose={1500}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
      />
      <AppRouter />
  </> 
}

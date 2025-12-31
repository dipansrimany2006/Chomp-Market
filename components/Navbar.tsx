"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { Plus, User, LogOut, ChevronDown, LayoutDashboard } from "lucide-react";
import RegisterModal from "./RegisterModal";

interface UserData {
  name: string;
  email: string;
  walletAddress: string;
}

const Navbar = () => {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isCheckingUser, setIsCheckingUser] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const walletAddress = user?.wallet?.address;

  const checkUserExists = useCallback(async (address: string) => {
    setIsCheckingUser(true);
    try {
      const response = await fetch(
        `/api/user?walletAddress=${encodeURIComponent(address)}`
      );
      const data = await response.json();

      if (data.exists && data.user) {
        setUserData(data.user);
        setShowRegisterModal(false);
      } else {
        setUserData(null);
        setShowRegisterModal(true);
      }
    } catch (error) {
      console.error("Error checking user:", error);
    } finally {
      setIsCheckingUser(false);
    }
  }, []);

  useEffect(() => {
    if (authenticated && walletAddress) {
      checkUserExists(walletAddress);
    } else {
      setUserData(null);
      setShowRegisterModal(false);
    }
  }, [authenticated, walletAddress, checkUserExists]);

  const handleWalletClick = () => {
    if (authenticated) {
      setShowUserMenu(!showUserMenu);
    } else {
      login();
    }
  };

  const handleLogout = () => {
    logout();
    setUserData(null);
    setShowUserMenu(false);
  };

  const handleRegistrationSuccess = (data: { name: string; email: string }) => {
    setUserData({
      name: data.name,
      email: data.email,
      walletAddress: walletAddress || "",
    });
    setShowRegisterModal(false);
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-user-menu]")) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showUserMenu]);

  return (
    <>
      <div className="h-16 w-full bg-black text-foreground flex items-center justify-between px-6 m-4">
        {/* Logo */}
        <div className="flex items-center">
          <Image
            src="/chomp.png"
            alt="Chomp Market"
            width={50}
            height={12}
          />
          <Image
            src="/logo.png"
            alt="Logo"
            width={80}
            height={32}
            className="mr-2"
          />
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-md mx-8">
          <div className="relative">
            <input
              type="text"
              placeholder="Search markets..."
              className="w-full bg-muted border border-border rounded-full px-4 py-2 pl-10 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">

          {/* Create Market Button */}
          <Link
            href="/create"
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 rounded-full px-4 py-2 text-sm font-medium text-primary-foreground transition-all"
          >
            <Plus className="h-4 w-4" />
            Create Market
          </Link>

          {/* Wallet/User Button */}
          <div className="relative" data-user-menu>
            <button
              type="button"
              onClick={handleWalletClick}
              disabled={!ready || isCheckingUser}
              className="flex items-center gap-2 bg-muted hover:bg-muted/80 border border-border rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!ready || isCheckingUser ? (
                "Loading..."
              ) : authenticated ? (
                <>
                  {userData ? (
                    <>
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                        <User className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                      <span className="max-w-[100px] truncate">
                        {userData.name}
                      </span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </>
                  ) : (
                    walletAddress && truncateAddress(walletAddress)
                  )}
                </>
              ) : (
                "Connect Wallet"
              )}
            </button>

            {/* User Dropdown Menu */}
            {showUserMenu && authenticated && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-card/95 border border-border backdrop-blur-xl shadow-xl overflow-hidden z-50">
                {userData && (
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-medium text-foreground truncate">
                      {userData.name}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      {walletAddress && truncateAddress(walletAddress)}
                    </p>
                  </div>
                )}
                <Link
                  href="/my-markets"
                  onClick={() => setShowUserMenu(false)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border-b border-border"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  My Markets
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Disconnect Wallet
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Registration Modal */}
      {walletAddress && (
        <RegisterModal
          isOpen={showRegisterModal}
          onClose={() => setShowRegisterModal(false)}
          walletAddress={walletAddress}
          onSuccess={handleRegistrationSuccess}
        />
      )}
    </>
  );
};

export default Navbar;

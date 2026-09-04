from django.urls import path
from .views import (
    RegisterView,
    LoginView,
    AdminLoginView,
    LogoutView,
    CurrentUserView,
    ProfileUpdateView,
    ChangePasswordView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='auth-register'),
    path('login/', LoginView.as_view(), name='auth-login'),
    path('admin-login/', AdminLoginView.as_view(), name='auth-admin-login'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('me/', CurrentUserView.as_view(), name='auth-me'),
    path('profile/', ProfileUpdateView.as_view(), name='auth-profile'),
    path('change-password/', ChangePasswordView.as_view(), name='auth-change-password'),
]

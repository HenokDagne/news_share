from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import NewsViewSet,UserViewSet

router = DefaultRouter()
router.register(r'news', NewsViewSet, basename='news')
router.register(r'users', UserViewSet, basename='user')

urlpatterns = [
    path('', include(router.urls)),
]

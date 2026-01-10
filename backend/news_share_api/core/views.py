from rest_framework.viewsets import ViewSet
from rest_framework.response import Response
from rest_framework.decorators import action
from django.conf import settings
from rest_framework import status
import requests
from .serializers import NewsArticleSerializer
from rest_framework import viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate


def deduplicate_articles(articles):
    seen_urls = set()
    unique = []
    for article in articles:
        url = article.get('url', '')
        if url and url not in seen_urls:
            seen_urls.add(url)
            unique.append(article)
    return unique

class NewsViewSet(ViewSet):
    """
    ViewSet to fetch Tesla news + Business news from NewsAPI using a serializer
    """

    def list(self, request):
        api_key = getattr(settings, 'NEWSAPI_KEY', None)
        if not api_key:
            return Response({"error": "API key not configured"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            tesla_url = 'https://newsapi.org/v2/everything?q=tesla&from=2025-11-21&sortBy=publishedAt'
            business_url = 'https://newsapi.org/v2/top-headlines?country=us&category=business'

            # Fetch Tesla news
            tesla_resp = requests.get(tesla_url, params={'apiKey': api_key})
            tesla_articles = tesla_resp.json().get('articles', []) if tesla_resp.status_code == 200 else []

            # Fetch Business news
            business_resp = requests.get(business_url, params={'apiKey': api_key})
            business_articles = business_resp.json().get('articles', []) if business_resp.status_code == 200 else []

            # Combine and deduplicate
            all_articles = tesla_articles + business_articles
            unique_articles = deduplicate_articles(all_articles)

            # Serialize
            serializer = NewsArticleSerializer(unique_articles, many=True)

            # Response headers
            headers = {
                'X-Tesla-Count': str(len(tesla_articles)),
                'X-Business-Count': str(len(business_articles)),
                'X-Total-Unique': str(len(unique_articles)),
            }

            return Response(serializer.data, headers=headers, status=status.HTTP_200_OK)

        except requests.RequestException as e:
            return Response({"error": str(e)}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as e:
            return Response({"error": "Server error", "message": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        


class UserViewSet(viewsets.ViewSet):
    """
    ViewSet to handle user-related operations
    """
    from .serializers import CustomUserSerializer
    from .models import CustomUser

    serializer_class = CustomUserSerializer
    queryset = CustomUser.objects.all()

    # -------- SIGNUP (auto-login after signup) --------
    @action(detail=False, methods=["post"], permission_classes=[AllowAny], url_path="signup")
    def signup(self, request):
        data = request.data
        required = ["username", "email", "date_birth", "gender", "password"]

        for field in required:
            if field not in data:
                return Response({"error": f"{field} is required"}, status=400)

        serializer = self.serializer_class(data=data)
        if serializer.is_valid():
            # Save user
            user = serializer.save()
            user.set_password(data["password"])
            user.save()

            # Generate JWT tokens immediately (auto-login)
            refresh = RefreshToken.for_user(user)
            return Response({
                "message": "Account created successfully and logged in.",
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "access_expires_in_minutes": 5,
                "refresh_expires_in_days": 1,
            }, status=201)

        return Response(serializer.errors, status=400)


    @action (detail=False, methods=["post"], permission_classes = [AllowAny], url_path="login")
    def login(self, request):
        email = request.data.get("email")
        password = request.data.get("password")
        
        user = authenticate(request, username=email, password=password)
        if not user:
            return Response({"error": "Invalid email or password"}, status=401)
        
        #Generate JWT Tokens
        refresh = RefreshToken.for_user(user)
        return Response({
            "message": "Login successful.",
            "access": str(refresh.access_token),
            "refresh": str(refresh)
        })
    



        # ---------------- LOGOUT WITH BLACKLIST ----------------

    @action(detail=False, methods=["post"], permission_classes=[IsAuthenticated], url_path="logout")
    def logout(self, request):
        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()  # <--- this blocks the token
            return Response({"message": "Logged out and token blacklisted."}, status=205)

        except Exception:
            return Response({"error": "Invalid token or token missing."}, status=400)








    
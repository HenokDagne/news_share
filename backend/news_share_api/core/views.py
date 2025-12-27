from rest_framework.viewsets import ViewSet
from rest_framework.response import Response
from django.conf import settings
from rest_framework import status
import requests
from .serializers import NewsArticleSerializer

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

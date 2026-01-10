from rest_framework import serializers
from .models import CustomUser
class NewsArticleSerializer(serializers.Serializer):
    title = serializers.CharField()
    description = serializers.CharField(allow_null=True, required=False)
    url = serializers.URLField()
    source = serializers.CharField(source='source.name', allow_null=True, required=False)
    publishedAt = serializers.DateTimeField()
    author = serializers.CharField(allow_null=True, required=False)
    urlToImage = serializers.URLField(allow_null=True, required=False)

class CustomUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email', 'phone', 'bio', 'name', 'date_birth', 'gender']
        
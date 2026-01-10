from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from .serilaizers import PostSerializer
from .models import Post
from rest_framework import viewsets
from rest_framework.response import Response



class PostViewSet(viewsets.ViewSet):

    serializer_class = PostSerializer
    queryset = Post.objects.all().order_by('-created_at')


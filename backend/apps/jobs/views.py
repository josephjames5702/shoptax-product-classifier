from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import ProcessingJob
from .serializers import ProcessingJobSerializer
from services.pipeline_runner import PipelineRunner

class ProcessingJobViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ProcessingJob.objects.select_related('catalog').prefetch_related('chunks').all()
    serializer_class = ProcessingJobSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        catalog_id = self.request.query_params.get('catalog_id')
        if catalog_id:
            qs = qs.filter(catalog_id=catalog_id)
        return qs

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel_job(self, request, pk=None):
        job = self.get_object()
        if job.status in [ProcessingJob.JobStatus.COMPLETED, ProcessingJob.JobStatus.FAILED, ProcessingJob.JobStatus.CANCELLED]:
            return Response({'error': f'Job is already in {job.status} state.'}, status=status.HTTP_400_BAD_REQUEST)

        job.status = ProcessingJob.JobStatus.CANCELLED
        job.current_step = 'Cancelled by user'
        job.save(update_fields=['status', 'current_step', 'updated_at'])

        return Response({'message': 'Processing job cancelled successfully.'})

    @action(detail=True, methods=['post'], url_path='resume')
    def resume_job(self, request, pk=None):
        job = self.get_object()
        if job.status == ProcessingJob.JobStatus.COMPLETED:
            return Response({'message': 'Job is already COMPLETED.'}, status=status.HTTP_200_OK)

        runner = PipelineRunner(job.catalog, job, batch_size=50)
        runner.run(retry_failed_only=False)

        job.refresh_from_db()
        return Response({
            'message': 'Job resumed successfully.',
            'job': ProcessingJobSerializer(job).data
        })
